import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600';

export const buttonClass =
  'inline-flex w-full items-center justify-center rounded-md bg-indigo-700 px-4 py-2.5 font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:opacity-60';

export function Field({
  id,
  label,
  error,
  hint,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & Omit<ComponentProps<'input'>, 'id'>) {
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <p className="text-lg font-semibold tracking-tight">
        <Link href="/">SlotWise</Link>
      </p>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6">{children}</div>
      <p className="mt-6 text-sm text-slate-700">{footer}</p>
    </main>
  );
}
