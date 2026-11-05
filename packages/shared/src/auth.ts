import { z } from 'zod';

export const ROLES = ['owner', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

/** The shared demo owner's address. Nobody else can register it. */
export const DEMO_EMAIL = 'demo@slotwise.dev';

/** An email that a person may register: valid, and not the demo owner's. */
export const registrableEmail = email.refine(
  (value) => value !== DEMO_EMAIL,
  'This email address is reserved',
);

export const signupSchema = z.object({
  email: registrableEmail,
  password: z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(128, 'Use at most 128 characters'),
  businessName: z.string().trim().min(2, 'Enter your business name').max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lower-case letters, digits and single hyphens',
    )
    .max(48)
    .optional(),
  timeZone: z.string().refine(isTimeZone, 'Choose a valid time zone'),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  /** The shared demo owner: it cannot change its password or email or delete the business. */
  isDemo: boolean;
}

export interface SessionBusiness {
  id: string;
  slug: string;
  name: string;
  timeZone: string;
}

export interface SessionInfo {
  user: SessionUser;
  business: SessionBusiness;
}

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10, 'Use at least 10 characters').max(128),
});
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const emailChangeSchema = z.object({
  email: registrableEmail,
  password: z.string().min(1).max(128),
});
export type EmailChangeInput = z.infer<typeof emailChangeSchema>;

export const deleteBusinessSchema = z.object({
  password: z.string().min(1).max(128),
});
export type DeleteBusinessInput = z.infer<typeof deleteBusinessSchema>;
