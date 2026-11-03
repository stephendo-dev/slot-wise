import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  hhmmToMinutes,
  minutesToHhmm,
  type HoursInput,
  type StaffCreateInput,
  type StaffUpdateInput,
  type StaffView,
} from '@slotwise/shared';
import { uniqueViolation } from '../auth/auth.service.js';
import { DatabaseService } from '../db/database.service.js';
import { staff, users, workingHours } from '../db/schema.js';

@Injectable()
export class StaffService {
  constructor(private readonly database: DatabaseService) {}

  async list(businessId: string): Promise<StaffView[]> {
    const { db } = this.database;
    const rows = await db
      .select({ staff, email: users.email })
      .from(staff)
      .leftJoin(users, eq(staff.userId, users.id))
      .where(eq(staff.businessId, businessId))
      .orderBy(staff.name);
    const hours = rows.length
      ? await db
          .select()
          .from(workingHours)
          .where(
            inArray(
              workingHours.staffId,
              rows.map((row) => row.staff.id),
            ),
          )
      : [];
    return rows.map(({ staff: member, email }) =>
      this.toView(
        member,
        email,
        hours.filter((h) => h.staffId === member.id),
      ),
    );
  }

  async create(
    businessId: string,
    input: StaffCreateInput,
  ): Promise<StaffView> {
    const passwordHash = input.password
      ? await argon2.hash(input.password)
      : undefined;
    try {
      return await this.database.db.transaction(async (tx) => {
        let userId: string | undefined;
        if (input.email && passwordHash) {
          const [user] = await tx
            .insert(users)
            .values({
              email: input.email,
              passwordHash,
              role: 'staff',
              businessId,
            })
            .returning();
          userId = user!.id;
        }
        const [member] = await tx
          .insert(staff)
          .values({ businessId, name: input.name, userId })
          .returning();
        return this.toView(member!, input.email ?? null, []);
      });
    } catch (error) {
      if (uniqueViolation(error) === 'users_email_unique') {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async rename(
    businessId: string,
    id: string,
    input: StaffUpdateInput,
  ): Promise<void> {
    await this.mustUpdate(
      this.database.db
        .update(staff)
        .set({ name: input.name })
        .where(and(eq(staff.id, id), eq(staff.businessId, businessId)))
        .returning({ id: staff.id }),
    );
  }

  async archive(businessId: string, id: string): Promise<void> {
    await this.mustUpdate(
      this.database.db
        .update(staff)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(staff.id, id),
            eq(staff.businessId, businessId),
            isNull(staff.archivedAt),
          ),
        )
        .returning({ id: staff.id }),
    );
  }

  async setHours(
    businessId: string,
    id: string,
    input: HoursInput,
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const found = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.id, id), eq(staff.businessId, businessId)));
      if (found.length === 0) throw new NotFoundException();
      await tx.delete(workingHours).where(eq(workingHours.staffId, id));
      if (input.ranges.length === 0) return;
      await tx.insert(workingHours).values(
        input.ranges.map((range) => ({
          staffId: id,
          weekday: range.weekday,
          startMinute: hhmmToMinutes(range.start)!,
          endMinute: hhmmToMinutes(range.end)!,
        })),
      );
    });
  }

  private async mustUpdate(update: Promise<unknown[]>): Promise<void> {
    if ((await update).length === 0) throw new NotFoundException();
  }

  private toView(
    member: typeof staff.$inferSelect,
    email: string | null,
    hours: (typeof workingHours.$inferSelect)[],
  ): StaffView {
    return {
      id: member.id,
      name: member.name,
      email,
      archived: member.archivedAt !== null,
      hours: hours
        .map((h) => ({
          weekday: h.weekday,
          start: minutesToHhmm(h.startMinute),
          end: minutesToHhmm(h.endMinute),
        }))
        .sort(
          (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start),
        ),
    };
  }
}
