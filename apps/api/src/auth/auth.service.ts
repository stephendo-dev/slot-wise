import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq, gt, lt } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import {
  slugify,
  type LoginInput,
  type SessionInfo,
  type SignupInput,
} from '@slotwise/shared';
import { DatabaseService } from '../db/database.service.js';
import { businesses, sessions, users } from '../db/schema.js';
import { LoginRateLimiter } from './login-rate-limiter.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// Verified against when the email is unknown, so that a missing account and a
// wrong password take the same time.
const unknownAccountHash = argon2.hash(randomBytes(16).toString('hex'));

interface PgError {
  code?: string;
  constraint?: string;
}

function uniqueViolation(error: unknown): string | undefined {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  for (const candidate of candidates) {
    const pg = candidate as PgError | null;
    if (pg?.code === '23505') return pg.constraint;
  }
  return undefined;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  async signup(
    input: SignupInput,
  ): Promise<{ token: string; info: SessionInfo }> {
    const slug = input.slug ?? slugify(input.businessName);
    if (!slug) {
      throw new BadRequestException(
        'Choose a web address for your booking page',
      );
    }
    const passwordHash = await argon2.hash(input.password);

    try {
      return await this.database.db.transaction(async (tx) => {
        const [business] = await tx
          .insert(businesses)
          .values({ slug, name: input.businessName, timeZone: input.timeZone })
          .returning();
        const [user] = await tx
          .insert(users)
          .values({
            email: input.email,
            passwordHash,
            role: 'owner',
            businessId: business!.id,
          })
          .returning();
        const token = await this.createSession(user!.id, tx);
        return { token, info: this.toInfo(user!, business!) };
      });
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint === 'users_email_unique') {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      if (constraint === 'businesses_slug_unique') {
        throw new ConflictException(
          'This booking page address is already taken',
        );
      }
      throw error;
    }
  }

  async login(
    input: LoginInput,
    clientAddress: string,
  ): Promise<{ token: string; info: SessionInfo }> {
    const key = `${clientAddress}|${input.email}`;
    if (this.limiter.isBlocked(key)) {
      throw new HttpException(
        'Too many failed attempts. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [row] = await this.database.db
      .select({ user: users, business: businesses })
      .from(users)
      .innerJoin(businesses, eq(users.businessId, businesses.id))
      .where(eq(users.email, input.email));

    const hash = row?.user.passwordHash ?? (await unknownAccountHash);
    const valid = await argon2.verify(hash, input.password);
    if (!row || !valid) {
      this.limiter.recordFailure(key);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.limiter.reset(key);
    await this.database.db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, row.user.id),
          lt(sessions.expiresAt, new Date()),
        ),
      );
    const token = await this.createSession(row.user.id);
    return { token, info: this.toInfo(row.user, row.business) };
  }

  async logout(token: string): Promise<void> {
    await this.database.db
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
  }

  async resolve(token: string): Promise<SessionInfo | undefined> {
    const [row] = await this.database.db
      .select({ user: users, business: businesses })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .innerJoin(businesses, eq(users.businessId, businesses.id))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, new Date()),
        ),
      );
    return row ? this.toInfo(row.user, row.business) : undefined;
  }

  private async createSession(
    userId: string,
    executor: Pick<DatabaseService['db'], 'insert'> = this.database.db,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await executor.insert(sessions).values({
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return token;
  }

  private toInfo(
    user: typeof users.$inferSelect,
    business: typeof businesses.$inferSelect,
  ): SessionInfo {
    return {
      user: { id: user.id, email: user.email, role: user.role },
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        timeZone: business.timeZone,
      },
    };
  }
}
