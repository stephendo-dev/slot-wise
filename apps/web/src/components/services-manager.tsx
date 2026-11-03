'use client';

import { useState, type FormEvent } from 'react';
import type { ServiceView, StaffView } from '@slotwise/shared';
import { buttonClass, Field } from './auth-form';
import { Alert, Card, smallButton, useMutation } from './manager-ui';

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function StaffLinks({
  service,
  staff,
}: {
  service: ServiceView;
  staff: StaffView[];
}) {
  const { run, message, busy } = useMutation();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run('PUT', `/services/${service.id}/staff`, {
      staffIds: data.getAll('staff'),
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      <fieldset>
        <legend className="text-sm font-medium">Performed by</legend>
        {staff.map((member) => (
          <label
            key={member.id}
            className="mr-4 inline-flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              name="staff"
              value={member.id}
              defaultChecked={service.staffIds.includes(member.id)}
            />
            {member.name}
          </label>
        ))}
      </fieldset>
      <Alert message={message} />
      <button type="submit" className={smallButton} disabled={busy}>
        Save staff
      </button>
    </form>
  );
}

export function ServicesManager({
  services,
  staff,
}: {
  services: ServiceView[];
  staff: StaffView[];
}) {
  const { run, message, busy } = useMutation();
  const [formKey, setFormKey] = useState(0);
  const active = staff.filter((member) => !member.archived);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await run('POST', '/services', {
      name: data.get('name'),
      durationMinutes: Number(data.get('durationMinutes')),
      priceCents: Math.round(Number(data.get('price')) * 100),
    });
    if (ok) setFormKey((key) => key + 1);
  }

  return (
    <div className="space-y-8">
      <form
        key={formKey}
        onSubmit={onAdd}
        className="space-y-4"
        aria-label="Add a service"
      >
        <Field id="name" label="Name" required />
        <Field
          id="durationMinutes"
          label="Duration (minutes, in steps of 15)"
          type="number"
          min={15}
          max={480}
          step={15}
          defaultValue={30}
          required
        />
        <Field
          id="price"
          label="Price (USD)"
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
          required
        />
        <Alert message={message} />
        <button type="submit" className={buttonClass} disabled={busy}>
          Add service
        </button>
      </form>

      <ul className="space-y-4">
        {services.map((service) => (
          <Card key={service.id}>
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">
                {service.name}
                {service.archived ? ' (archived)' : ''}
                <span className="ml-2 font-normal text-slate-600">
                  {service.durationMinutes} min ·{' '}
                  {formatPrice(service.priceCents)}
                </span>
              </p>
              {service.archived ? null : (
                <button
                  type="button"
                  className={smallButton}
                  onClick={() => run('POST', `/services/${service.id}/archive`)}
                >
                  Archive
                </button>
              )}
            </div>
            {service.archived ? null : (
              <StaffLinks service={service} staff={active} />
            )}
          </Card>
        ))}
        {services.length === 0 ? (
          <li className="text-slate-600">No services yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
