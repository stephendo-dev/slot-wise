'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { BookingCreated, PublicBusiness } from '@slotwise/shared';
import { formatDay, formatPrice, formatTime, groupByDay } from '@/lib/format';
import { mutate } from '@/lib/api-client';
import { buttonClass, Field } from './auth-form';
import { Alert } from './manager-ui';

const ANYONE = 'anyone';

export function BookingFlow({ business }: { business: PublicBusiness }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState(ANYONE);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const service = business.services.find((item) => item.id === serviceId);

  async function loadSlots(nextService: string, nextStaff: string) {
    setSlot('');
    setSlots([]);
    setMessage('');
    if (!nextService) return;
    const query = new URLSearchParams({ serviceId: nextService });
    if (nextStaff !== ANYONE) query.set('staffId', nextStaff);
    try {
      const res = await fetch(`/api/public/b/${business.slug}/slots?${query}`);
      const body = (await res.json()) as { slots?: string[] };
      setSlots(body.slots ?? []);
    } catch {
      setMessage('Could not load the times. Try again in a moment.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    const result = await mutate('POST', `/public/b/${business.slug}/bookings`, {
      serviceId,
      ...(staffId === ANYONE ? {} : { staffId }),
      start: slot,
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone'),
    });
    if (result.ok) {
      router.push(`/booking/${(result.body as BookingCreated).manageToken}`);
      return;
    }
    setMessage(result.message);
    setBusy(false);
    // The time may have just been taken: show fresh slots.
    await loadSlots(serviceId, staffId);
    setMessage(result.message);
  }

  return (
    <div className="space-y-8">
      <fieldset className="space-y-2">
        <legend className="text-lg font-medium">1. Choose a service</legend>
        {business.services.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 rounded-md border border-slate-200 p-3"
          >
            <input
              type="radio"
              name="service"
              value={item.id}
              checked={serviceId === item.id}
              onChange={() => {
                setServiceId(item.id);
                setStaffId(ANYONE);
                void loadSlots(item.id, ANYONE);
              }}
            />
            <span>
              {item.name}
              <span className="ml-2 text-slate-600">
                {item.durationMinutes} min · {formatPrice(item.priceCents)}
              </span>
            </span>
          </label>
        ))}
        {business.services.length === 0 ? (
          <p className="text-slate-600">
            This business has no services to book yet.
          </p>
        ) : null}
      </fieldset>

      {service ? (
        <div>
          <label htmlFor="staff" className="block text-lg font-medium">
            2. Choose who
          </label>
          <select
            id="staff"
            value={staffId}
            onChange={(event) => {
              setStaffId(event.target.value);
              void loadSlots(serviceId, event.target.value);
            }}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value={ANYONE}>Anyone</option>
            {service.staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {service ? (
        <fieldset>
          <legend className="text-lg font-medium">3. Choose a time</legend>
          <p className="text-sm text-slate-600">
            Times are in {business.timeZone}.
          </p>
          {slots.length === 0 ? (
            <p className="mt-2 text-slate-700">
              No free times in the next 30 days.
            </p>
          ) : (
            <div className="mt-3 max-h-80 space-y-4 overflow-y-auto">
              {groupByDay(slots, business.timeZone).map((group) => (
                <div key={group.day}>
                  <p className="text-sm font-medium">{group.day}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {group.slots.map((iso) => (
                      <label
                        key={iso}
                        className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600 ${
                          slot === iso
                            ? 'border-indigo-700 bg-indigo-700 text-white'
                            : 'border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="slot"
                          value={iso}
                          className="sr-only"
                          checked={slot === iso}
                          onChange={() => setSlot(iso)}
                        />
                        {formatTime(iso, business.timeZone)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}

      {slot ? (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <h2 className="text-lg font-medium">4. Your details</h2>
          <p className="text-slate-700">
            {service?.name} on {formatDay(slot, business.timeZone)} at{' '}
            {formatTime(slot, business.timeZone)}
          </p>
          <Field id="name" label="Name" autoComplete="name" required />
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
          />
          <Field
            id="phone"
            label="Phone"
            type="tel"
            autoComplete="tel"
            required
          />
          <Alert message={message} />
          <button type="submit" className={buttonClass} disabled={busy}>
            {busy ? 'Booking…' : 'Book'}
          </button>
        </form>
      ) : (
        <Alert message={message} />
      )}
    </div>
  );
}
