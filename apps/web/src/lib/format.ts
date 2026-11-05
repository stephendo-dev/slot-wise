/** "Tue, 3 Nov" for an instant, in the business's time zone. */
export function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

/** "14:30" for an instant, in the business's time zone. */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** The slots split by the business's local day, in order. */
export function groupByDay(
  slots: string[],
  timeZone: string,
): { day: string; slots: string[] }[] {
  const groups: { day: string; slots: string[] }[] = [];
  for (const iso of slots) {
    const day = formatDay(iso, timeZone);
    const last = groups.at(-1);
    if (last?.day === day) last.slots.push(iso);
    else groups.push({ day, slots: [iso] });
  }
  return groups;
}

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
