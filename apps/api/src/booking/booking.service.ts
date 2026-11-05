import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, inArray, isNull, lt } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import type {
  BookingCreateInput,
  BookingCreated,
  BookingSummary,
  PublicBusiness,
} from '@slotwise/shared';
import { DatabaseService } from '../db/database.service.js';
import {
  bookings,
  businesses,
  serviceStaff,
  services,
  staff,
  workingHours,
} from '../db/schema.js';
import {
  chooseStaff,
  computeSlots,
  localDay,
  type Busy,
} from '../slots/slots.js';

const HORIZON_DAYS = 31;
const EXCLUSION_VIOLATION = '23P01';
const TAKEN = 'This time was just taken. Please pick another time.';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

function pgCode(error: unknown): string | undefined {
  for (const candidate of [
    error,
    (error as { cause?: unknown } | null)?.cause,
  ]) {
    const code = (candidate as { code?: string } | null)?.code;
    if (code) return code;
  }
  return undefined;
}

interface Context {
  business: typeof businesses.$inferSelect;
  service: typeof services.$inferSelect;
  staff: { id: string; name: string }[];
}

@Injectable()
export class BookingService {
  constructor(private readonly database: DatabaseService) {}

  async business(slug: string): Promise<PublicBusiness> {
    const { db } = this.database;
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, slug));
    if (!business) throw new NotFoundException();

    const rows = await db
      .select({ service: services, staffId: staff.id, staffName: staff.name })
      .from(services)
      .innerJoin(serviceStaff, eq(serviceStaff.serviceId, services.id))
      .innerJoin(staff, eq(serviceStaff.staffId, staff.id))
      .where(
        and(
          eq(services.businessId, business.id),
          isNull(services.archivedAt),
          isNull(staff.archivedAt),
        ),
      )
      .orderBy(services.name, staff.name);

    const byService = new Map<string, PublicBusiness['services'][number]>();
    for (const row of rows) {
      const entry = byService.get(row.service.id) ?? {
        id: row.service.id,
        name: row.service.name,
        durationMinutes: row.service.durationMinutes,
        priceCents: row.service.priceCents,
        staff: [],
      };
      entry.staff.push({ id: row.staffId, name: row.staffName });
      byService.set(row.service.id, entry);
    }
    return {
      slug: business.slug,
      name: business.name,
      timeZone: business.timeZone,
      services: [...byService.values()],
    };
  }

  /** Start times (ISO) for a service, for one staff member or for anyone who performs it. */
  async slots(
    slug: string,
    serviceId: string,
    staffId?: string,
  ): Promise<string[]> {
    const context = await this.context(slug, serviceId);
    const candidates = this.candidates(context, staffId);
    const { slotsByStaff } = await this.compute(
      context,
      candidates.map((c) => c.id),
    );
    const all = new Set<number>();
    for (const slots of slotsByStaff.values())
      for (const ms of slots) all.add(ms);
    return [...all]
      .sort((a, b) => a - b)
      .map((ms) => new Date(ms).toISOString());
  }

  async create(
    slug: string,
    input: BookingCreateInput,
  ): Promise<BookingCreated> {
    const context = await this.context(slug, input.serviceId);
    const candidates = this.candidates(context, input.staffId);
    const start = Date.parse(input.start);
    const { slotsByStaff, busyByStaff } = await this.compute(
      context,
      candidates.map((c) => c.id),
    );

    const free = candidates.filter((c) =>
      slotsByStaff.get(c.id)?.includes(start),
    );
    const day = localDay(start, context.business.timeZone);
    const token = randomBytes(32).toString('base64url');
    const end = start + context.service.durationMinutes * 60_000;

    // "Anyone": try the least busy free staff member first; if the database
    // refuses (someone else just took them), try the next.
    const remaining = free.map((c) => c.id);
    while (remaining.length > 0) {
      const staffId = chooseStaff(
        remaining.map((id) => ({
          staffId: id,
          bookingsThatDay: (busyByStaff.get(id) ?? []).filter(
            (busy) => localDay(busy.start, context.business.timeZone) === day,
          ).length,
        })),
      )!;
      try {
        await this.database.db.insert(bookings).values({
          businessId: context.business.id,
          staffId,
          serviceId: context.service.id,
          startAt: new Date(start),
          endAt: new Date(end),
          customerName: input.name,
          customerEmail: input.email,
          customerPhone: input.phone,
          manageTokenHash: hashToken(token),
        });
      } catch (error) {
        if (pgCode(error) !== EXCLUSION_VIOLATION) throw error;
        remaining.splice(remaining.indexOf(staffId), 1);
        continue;
      }
      const chosen = candidates.find((c) => c.id === staffId)!;
      return {
        manageToken: token,
        booking: this.summary(context, chosen.name, start, end, 'confirmed'),
      };
    }
    throw new ConflictException(TAKEN);
  }

  async view(token: string): Promise<BookingSummary> {
    return this.summaryOf(await this.byToken(token));
  }

  async cancel(token: string): Promise<BookingSummary> {
    const found = await this.byToken(token);
    if (found.booking.status === 'cancelled') return this.summaryOf(found);
    if (found.booking.startAt.getTime() <= Date.now()) {
      throw new ConflictException(
        'This booking has already started and can no longer be cancelled',
      );
    }
    await this.database.db
      .update(bookings)
      .set({ status: 'cancelled' })
      .where(eq(bookings.id, found.booking.id));
    return this.summaryOf({
      ...found,
      booking: { ...found.booking, status: 'cancelled' },
    });
  }

  private async context(slug: string, serviceId: string): Promise<Context> {
    const { db } = this.database;
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, slug));
    if (!business) throw new NotFoundException();
    const [service] = await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.id, serviceId),
          eq(services.businessId, business.id),
          isNull(services.archivedAt),
        ),
      );
    if (!service) throw new NotFoundException();
    const people = await db
      .select({ id: staff.id, name: staff.name })
      .from(serviceStaff)
      .innerJoin(staff, eq(serviceStaff.staffId, staff.id))
      .where(
        and(eq(serviceStaff.serviceId, service.id), isNull(staff.archivedAt)),
      )
      .orderBy(staff.name);
    return { business, service, staff: people };
  }

  private candidates(context: Context, staffId?: string) {
    if (!staffId) return context.staff;
    const one = context.staff.find((member) => member.id === staffId);
    if (!one) throw new NotFoundException();
    return [one];
  }

  private async compute(context: Context, staffIds: string[]) {
    const slotsByStaff = new Map<string, number[]>();
    const busyByStaff = new Map<string, Busy[]>();
    if (staffIds.length === 0) return { slotsByStaff, busyByStaff };

    const { db } = this.database;
    const now = Date.now();
    const horizon = new Date(now + HORIZON_DAYS * 24 * 60 * 60_000);
    const [hours, booked] = await Promise.all([
      db
        .select()
        .from(workingHours)
        .where(inArray(workingHours.staffId, staffIds)),
      db
        .select({
          staffId: bookings.staffId,
          start: bookings.startAt,
          end: bookings.endAt,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(bookings.status, 'confirmed'),
            gt(bookings.endAt, new Date(now)),
            lt(bookings.startAt, horizon),
          ),
        ),
    ]);

    for (const id of staffIds) {
      const busy = booked
        .filter((row) => row.staffId === id)
        .map((row) => ({ start: row.start.getTime(), end: row.end.getTime() }));
      busyByStaff.set(id, busy);
      slotsByStaff.set(
        id,
        computeSlots({
          timeZone: context.business.timeZone,
          hours: hours.filter((h) => h.staffId === id),
          busy,
          durationMinutes: context.service.durationMinutes,
          now,
        }),
      );
    }
    return { slotsByStaff, busyByStaff };
  }

  private async byToken(token: string) {
    const [found] = await this.database.db
      .select({
        booking: bookings,
        business: businesses,
        serviceName: services.name,
        staffName: staff.name,
      })
      .from(bookings)
      .innerJoin(businesses, eq(bookings.businessId, businesses.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(staff, eq(bookings.staffId, staff.id))
      .where(eq(bookings.manageTokenHash, hashToken(token)));
    if (!found) throw new NotFoundException();
    return found;
  }

  private summaryOf(
    found: Awaited<ReturnType<BookingService['byToken']>>,
  ): BookingSummary {
    return {
      business: found.business.name,
      timeZone: found.business.timeZone,
      service: found.serviceName,
      staff: found.staffName,
      start: found.booking.startAt.toISOString(),
      end: found.booking.endAt.toISOString(),
      status: found.booking.status,
    };
  }

  private summary(
    context: Context,
    staffName: string,
    start: number,
    end: number,
    status: BookingSummary['status'],
  ): BookingSummary {
    return {
      business: context.business.name,
      timeZone: context.business.timeZone,
      service: context.service.name,
      staff: staffName,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      status,
    };
  }
}
