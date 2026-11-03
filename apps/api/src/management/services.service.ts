import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ServiceInput, ServiceView } from '@slotwise/shared';
import { DatabaseService } from '../db/database.service.js';
import { serviceStaff, services, staff } from '../db/schema.js';

@Injectable()
export class ServicesService {
  constructor(private readonly database: DatabaseService) {}

  async list(businessId: string): Promise<ServiceView[]> {
    const { db } = this.database;
    const rows = await db
      .select()
      .from(services)
      .where(eq(services.businessId, businessId))
      .orderBy(services.name);
    const links = rows.length
      ? await db
          .select()
          .from(serviceStaff)
          .where(
            inArray(
              serviceStaff.serviceId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    return rows.map((row) =>
      this.toView(
        row,
        links.filter((l) => l.serviceId === row.id),
      ),
    );
  }

  async create(businessId: string, input: ServiceInput): Promise<ServiceView> {
    const [row] = await this.database.db
      .insert(services)
      .values({ businessId, ...input })
      .returning();
    return this.toView(row!, []);
  }

  async update(
    businessId: string,
    id: string,
    input: ServiceInput,
  ): Promise<void> {
    const updated = await this.database.db
      .update(services)
      .set(input)
      .where(and(eq(services.id, id), eq(services.businessId, businessId)))
      .returning({ id: services.id });
    if (updated.length === 0) throw new NotFoundException();
  }

  async archive(businessId: string, id: string): Promise<void> {
    const updated = await this.database.db
      .update(services)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(services.id, id),
          eq(services.businessId, businessId),
          isNull(services.archivedAt),
        ),
      )
      .returning({ id: services.id });
    if (updated.length === 0) throw new NotFoundException();
  }

  /** Replaces the staff who perform a service. A staff id of another business is a 404. */
  async setStaff(
    businessId: string,
    id: string,
    staffIds: string[],
  ): Promise<void> {
    const unique = [...new Set(staffIds)];
    await this.database.db.transaction(async (tx) => {
      const found = await tx
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.id, id), eq(services.businessId, businessId)));
      if (found.length === 0) throw new NotFoundException();
      if (unique.length > 0) {
        const own = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(
            and(inArray(staff.id, unique), eq(staff.businessId, businessId)),
          );
        if (own.length !== unique.length) throw new NotFoundException();
      }
      await tx.delete(serviceStaff).where(eq(serviceStaff.serviceId, id));
      if (unique.length > 0) {
        await tx
          .insert(serviceStaff)
          .values(unique.map((staffId) => ({ serviceId: id, staffId })));
      }
    });
  }

  private toView(
    row: typeof services.$inferSelect,
    links: (typeof serviceStaff.$inferSelect)[],
  ): ServiceView {
    return {
      id: row.id,
      name: row.name,
      durationMinutes: row.durationMinutes,
      priceCents: row.priceCents,
      archived: row.archivedAt !== null,
      staffIds: links.map((l) => l.staffId),
    };
  }
}
