'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { slugify } from '@slotwise/shared';
import { postAuth } from '@/lib/auth-client';
import { buttonClass, Field } from './auth-form';

// Read from the browser, with '' and [] on the server so hydration matches.
const noSubscription = () => () => undefined;
let zoneList: string[] | undefined;
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const browserZones = () => (zoneList ??= Intl.supportedValuesOf('timeZone'));
const noZones: string[] = [];

export function SignupForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const detectedZone = useSyncExternalStore(
    noSubscription,
    browserZone,
    () => '',
  );
  const zones = useSyncExternalStore(
    noSubscription,
    browserZones,
    () => noZones,
  );
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const timeZone = chosenZone ?? detectedZone;
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const slug = String(data.get('slug') ?? '').trim();
    setBusy(true);
    const result = await postAuth('/api/auth/signup', {
      email: data.get('email'),
      password: data.get('password'),
      businessName: data.get('businessName'),
      timeZone: data.get('timeZone'),
      ...(slug ? { slug } : {}),
    });
    if (result.ok) {
      router.push('/dashboard');
      return;
    }
    setFields(result.fields);
    setMessage(Object.keys(result.fields).length ? '' : result.message);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field
        id="businessName"
        label="Business name"
        autoComplete="organization"
        required
        value={businessName}
        onChange={(event) => setBusinessName(event.target.value)}
        error={fields.businessName}
      />
      <Field
        id="slug"
        label="Booking page address (optional)"
        hint={`Your page will be /b/${slugify(businessName) || 'your-business'} unless you choose another.`}
        autoComplete="off"
        error={fields.slug}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={fields.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        hint="At least 10 characters."
        error={fields.password}
      />
      <Field
        id="timeZone"
        label="Time zone"
        list="time-zones"
        required
        value={timeZone}
        onChange={(event) => setChosenZone(event.target.value)}
        error={fields.timeZone}
      />
      <datalist id="time-zones">
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <p role="alert" className="text-sm text-red-700">
        {message}
      </p>
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  );
}
