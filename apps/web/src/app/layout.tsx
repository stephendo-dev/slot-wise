import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { APP_NAME, APP_TAGLINE } from '@slotwise/shared';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME}: ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    'SlotWise gives salons, tutors, clinics and consultants an online booking page, staff calendars and a bookings dashboard. Customers book a free slot in under a minute, without an account.',
  applicationName: APP_NAME,
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME}: ${APP_TAGLINE}`,
    description:
      'An online booking page, staff calendars and a bookings dashboard for small service businesses.',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
