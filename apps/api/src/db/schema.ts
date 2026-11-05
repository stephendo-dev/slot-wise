import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { ROLES } from '@slotwise/shared';

export const userRole = pgEnum('user_role', ROLES);
export const bookingStatus = pgEnum('booking_status', [
  'confirmed',
  'cancelled',
]);

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The cookie holds a random token; only its SHA-256 is stored, so a leaked
// table cannot be replayed as a login.
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const staff = pgTable('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  // The login of a staff member who signs in to see their own bookings.
  userId: uuid('user_id')
    .unique()
    .references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  priceCents: integer('price_cents').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const serviceStaff = pgTable(
  'service_staff',
  {
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.serviceId, table.staffId] })],
);

export const workingHours = pgTable(
  'working_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
  },
  (table) => [
    index('working_hours_staff_idx').on(table.staffId),
    check(
      'working_hours_range',
      sql`${table.startMinute} < ${table.endMinute}`,
    ),
  ],
);

// The database, not only the API, refuses two confirmed bookings of one staff
// member that overlap: see the exclusion constraint in the migration
// `bookings_no_overlap`, which drizzle-kit cannot express.
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone').notNull(),
    status: bookingStatus('status').notNull().default('confirmed'),
    // Only the hash of the private link is kept.
    manageTokenHash: text('manage_token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('bookings_staff_start_idx').on(table.staffId, table.startAt),
    index('bookings_business_start_idx').on(table.businessId, table.startAt),
    check('bookings_range', sql`${table.startAt} < ${table.endAt}`),
  ],
);
