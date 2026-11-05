import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, lt } from 'drizzle-orm';
import type { DayBookings, SessionInfo } from '@slotwise/shared';
import { DatabaseService } from '../db/database.service.js';
import { bookings, services, staff } from '../db/schema.js';
import { dayRange } from '../slots/slots.js';

@Injectable()
export class BookingsAdminService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * The bookings of one local day, grouped by staff member. An owner sees every
   * staff member of the business; a staff user sees only their own bookings.
   */
  async day(session: SessionInfo, date: string): Promise<DayBookings> {
    const { business, user } = session;
    const { start, end } = dayRange(date, business.timeZone);
    const { db } = this.database;

    const people = await db
      .select({
        id: staff.id,
        name: staff.name,
        userId: staff.userId,
        archivedAt: staff.archivedAt,
      })
      .from(staff)
      .where(eq(staff.businessId, business.id))
      .orderBy(staff.name);
    const visible =
      user.role === 'owner'
        ? people
        : people.filter((p) => p.userId === user.id);

    const rows = await db
      .select({ booking: bookings, serviceName: services.name })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(
        and(
          eq(bookings.businessId, business.id),
          gte(bookings.startAt, new Date(start)),
          lt(bookings.startAt, new Date(end)),
        ),
      )
      .orderBy(bookings.startAt);

    return {
      date,
      timeZone: business.timeZone,
      groups: visible
        .map((person) => ({
          staffId: person.id,
          staffName: person.name,
          bookings: rows
            .filter((row) => row.booking.staffId === person.id)
            .map((row) => ({
              id: row.booking.id,
              service: row.serviceName,
              start: row.booking.startAt.toISOString(),
              end: row.booking.endAt.toISOString(),
              status: row.booking.status,
              customerName: row.booking.customerName,
              customerEmail: row.booking.customerEmail,
              customerPhone: row.booking.customerPhone,
            })),
        }))
        // An archived staff member with nothing that day is not worth a row.
        .filter(
          (group) =>
            group.bookings.length > 0 ||
            !people.find((p) => p.id === group.staffId)?.archivedAt,
        ),
    };
  }

  /** Cancels any booking of the owner's business. Another business's booking is a 404. */
  async cancel(session: SessionInfo, id: string): Promise<void> {
    if (session.user.role !== 'owner') throw new ForbiddenException();
    const updated = await this.database.db
      .update(bookings)
      .set({ status: 'cancelled' })
      .where(
        and(eq(bookings.id, id), eq(bookings.businessId, session.business.id)),
      )
      .returning({ id: bookings.id });
    if (updated.length === 0) throw new NotFoundException();
  }
}
