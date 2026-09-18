export const DEFAULT_TIME_ZONE = 'America/New_York';

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(
  value: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function formatDbWallClock(
  value: Date | string | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function formatDate(
  value: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}
