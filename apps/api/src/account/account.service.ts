import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq, ne } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type {
  DeleteBusinessInput,
  EmailChangeInput,
  PasswordChangeInput,
  SessionInfo,
} from '@slotwise/shared';
import { uniqueViolation } from '../auth/auth.service.js';
import { DatabaseService } from '../db/database.service.js';
import { businesses, sessions, users } from '../db/schema.js';

const DEMO_MESSAGE =
  'The demo account cannot change its password or email, or delete the business';

const hashOf = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AccountService {
  constructor(private readonly database: DatabaseService) {}

  async changePassword(
    session: SessionInfo,
    token: string,
    input: PasswordChangeInput,
  ): Promise<void> {
    await this.confirm(session, input.currentPassword);
    const passwordHash = await argon2.hash(input.newPassword);
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, session.user.id));
      // Every other device is signed out; this one stays.
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, session.user.id),
            ne(sessions.tokenHash, hashOf(token)),
          ),
        );
    });
  }

  async changeEmail(
    session: SessionInfo,
    input: EmailChangeInput,
  ): Promise<void> {
    await this.confirm(session, input.password);
    try {
      await this.database.db
        .update(users)
        .set({ email: input.email })
        .where(eq(users.id, session.user.id));
    } catch (error) {
      if (uniqueViolation(error) === 'users_email_unique') {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  /** Removes the business and everything under it (staff, services, bookings, logins). */
  async deleteBusiness(
    session: SessionInfo,
    input: DeleteBusinessInput,
  ): Promise<void> {
    await this.confirm(session, input.password);
    await this.database.db
      .delete(businesses)
      .where(eq(businesses.id, session.business.id));
  }

  /** The demo account is refused first; everyone else must give their current password. */
  private async confirm(session: SessionInfo, password: string): Promise<void> {
    if (session.user.isDemo) throw new ForbiddenException(DEMO_MESSAGE);
    const [row] = await this.database.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id));
    if (!row || !(await argon2.verify(row.passwordHash, password))) {
      throw new BadRequestException('The password is not right');
    }
  }
}
