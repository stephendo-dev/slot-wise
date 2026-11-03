import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-form';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in to SlotWise"
      footer={
        <>
          New here?{' '}
          <Link
            href="/signup"
            className="font-medium text-indigo-700 underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
