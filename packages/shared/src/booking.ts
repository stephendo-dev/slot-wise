import { z } from 'zod';

export const bookingCreateSchema = z.object({
  serviceId: z.uuid(),
  /** Leave out to let the business choose ("anyone"). */
  staffId: z.uuid().optional(),
  /** The start of the slot, as an ISO 8601 instant taken from the slots list. */
  start: z.iso.datetime(),
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address')),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\d][\d\s()+-]{5,19}$/, 'Enter a phone number'),
});
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export interface PublicService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  staff: { id: string; name: string }[];
}

export interface PublicBusiness {
  slug: string;
  name: string;
  timeZone: string;
  services: PublicService[];
}

/** What the customer sees of their own booking. */
export interface BookingSummary {
  business: string;
  timeZone: string;
  service: string;
  staff: string;
  start: string;
  end: string;
  status: 'confirmed' | 'cancelled';
}

export interface BookingCreated {
  booking: BookingSummary;
  /** Shown once. Only its hash is stored. */
  manageToken: string;
}
