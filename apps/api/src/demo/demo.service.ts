import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service.js';
import { DatabaseService } from '../db/database.service.js';
import {
  bookings,
  businesses,
  serviceStaff,
  services,
  staff,
  users,
  workingHours,
} from '../db/schema.js';
import {
  buildSeedBookings,
  DEMO_BUSINESS,
  DEMO_EMAIL,
  DEMO_SERVICES,
  DEMO_SLUG,
  DEMO_STAFF,
  DEMO_TIME_ZONE,
} from './demo-seed.js';

@Injectable()
export class DemoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  /** Signs the visitor in as the demo owner, creating and seeding the salon the first time. */
  async login() {
    const owner = await this.ensureOwner();
    const [existing] = await this.database.db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.businessId, owner.businessId))
      .limit(1);
    if (!existing) await this.reset();
    return this.auth.startSessionFor(owner.userId);
  }

  /** Puts the demo salon back to its seed, with the bookings moved to the coming 14 days. */
  async reset(now = Date.now()): Promise<{ bookings: number }> {
    const { businessId } = await this.ensureOwner();
    const plan = buildSeedBookings(now);

    await this.database.db.transaction(async (tx) => {
      await tx.delete(bookings).where(eq(bookings.businessId, businessId));
      await tx.delete(staff).where(eq(staff.businessId, businessId)); // hours and links go with it
      await tx.delete(services).where(eq(services.businessId, businessId));

      const serviceRows = await tx
        .insert(services)
        .values(DEMO_SERVICES.map((service) => ({ businessId, ...service })))
        .returning();
      const staffRows = await tx
        .insert(staff)
        .values(DEMO_STAFF.map((person) => ({ businessId, name: person.name })))
        .returning();

      await tx.insert(workingHours).values(
        DEMO_STAFF.flatMap((person, index) =>
          person.hours.map((hours) => ({
            staffId: staffRows[index]!.id,
            ...hours,
          })),
        ),
      );
      await tx.insert(serviceStaff).values(
        DEMO_STAFF.flatMap((person, index) =>
          person.services.map((serviceIndex) => ({
            serviceId: serviceRows[serviceIndex]!.id,
            staffId: staffRows[index]!.id,
          })),
        ),
      );
      if (plan.length > 0) {
        await tx.insert(bookings).values(
          plan.map((booking) => ({
            businessId,
            staffId: staffRows[booking.staffIndex]!.id,
            serviceId: serviceRows[booking.serviceIndex]!.id,
            startAt: new Date(booking.start),
            endAt: new Date(booking.end),
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
            // Nobody holds a private link to a demo booking.
            manageTokenHash: createHash('sha256')
              .update(randomBytes(32))
              .digest('hex'),
          })),
        );
      }
    });
    return { bookings: plan.length };
  }

  private async ensureOwner(): Promise<{ userId: string; businessId: string }> {
    const { db } = this.database;
    const [found] = await db
      .select({ userId: users.id, businessId: users.businessId })
      .from(users)
      .where(eq(users.email, DEMO_EMAIL));
    if (found) return found;

    // The demo owner has no usable password: it can only be entered through the demo button.
    const passwordHash = await argon2.hash(randomBytes(32).toString('hex'));
    return db.transaction(async (tx) => {
      const [business] = await tx
        .insert(businesses)
        .values({
          slug: DEMO_SLUG,
          name: DEMO_BUSINESS,
          timeZone: DEMO_TIME_ZONE,
        })
        .onConflictDoUpdate({
          target: businesses.slug,
          set: { name: DEMO_BUSINESS },
        })
        .returning();
      const [user] = await tx
        .insert(users)
        .values({
          email: DEMO_EMAIL,
          passwordHash,
          role: 'owner',
          businessId: business!.id,
          isDemo: true,
        })
        .returning();
      return { userId: user!.id, businessId: business!.id };
    });
  }
}
