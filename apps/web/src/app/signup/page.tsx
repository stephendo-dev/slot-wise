import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-form';
import { SignupForm } from '@/components/signup-form';

export const metadata: Metadata = {
  title: 'Create your account',
  robots: { index: false },
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your SlotWise account"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo-700 underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
