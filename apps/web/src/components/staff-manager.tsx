'use client';

import { useState, type FormEvent } from 'react';
import { WEEKDAYS, type StaffView } from '@slotwise/shared';
import { formatDay, parseDay } from '@/lib/hours';
import { buttonClass, Field } from './auth-form';
import { Alert, Card, smallButton, useMutation } from './manager-ui';

function HoursEditor({ member }: { member: StaffView }) {
  const { run, message, busy, setMessage } = useMutation();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ranges = [];
    for (const [weekday, day] of WEEKDAYS.entries()) {
      const parsed = parseDay(
        String(data.get(`day-${weekday}`) ?? ''),
        weekday,
      );
      if ('error' in parsed) {
        setMessage(`${day}: ${parsed.error}`);
        return;
      }
      ranges.push(...parsed.ranges);
    }
    await run('PUT', `/staff/${member.id}/hours`, { ranges });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 space-y-2"
      aria-label={`Working hours of ${member.name}`}
    >
      <p className="text-sm font-medium">
        Working hours (e.g. 09:00-12:00, 13:00-17:00)
      </p>
      {WEEKDAYS.map((day, weekday) => (
        <div key={day} className="grid grid-cols-[6rem_1fr] items-center gap-2">
          <label htmlFor={`${member.id}-${weekday}`} className="text-sm">
            {day}
          </label>
          <input
            id={`${member.id}-${weekday}`}
            name={`day-${weekday}`}
            defaultValue={formatDay(member.hours, weekday)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
      ))}
      <Alert message={message} />
      <button type="submit" className={smallButton} disabled={busy}>
        Save hours
      </button>
    </form>
  );
}

export function StaffManager({ staff }: { staff: StaffView[] }) {
  const { run, message, busy } = useMutation();
  const [formKey, setFormKey] = useState(0);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const ok = await run('POST', '/staff', {
      name: data.get('name'),
      ...(email ? { email, password } : {}),
    });
    if (ok) setFormKey((key) => key + 1);
  }

  return (
    <div className="space-y-8">
      <form
        key={formKey}
        onSubmit={onAdd}
        className="space-y-4"
        aria-label="Add a staff member"
      >
        <Field id="name" label="Name" required />
        <Field
          id="email"
          label="Login email (optional)"
          type="email"
          autoComplete="off"
        />
        <Field
          id="password"
          label="Login password (needed with an email)"
          type="password"
          autoComplete="new-password"
        />
        <Alert message={message} />
        <button type="submit" className={buttonClass} disabled={busy}>
          Add staff member
        </button>
      </form>

      <ul className="space-y-4">
        {staff.map((member) => (
          <Card key={member.id}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {member.name}
                  {member.archived ? ' (archived)' : ''}
                </p>
                {member.email ? (
                  <p className="text-sm text-slate-600">{member.email}</p>
                ) : null}
              </div>
              {member.archived ? null : (
                <button
                  type="button"
                  className={smallButton}
                  onClick={() => run('POST', `/staff/${member.id}/archive`)}
                >
                  Archive
                </button>
              )}
            </div>
            {member.archived ? null : <HoursEditor member={member} />}
          </Card>
        ))}
        {staff.length === 0 ? (
          <li className="text-slate-600">No staff yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
