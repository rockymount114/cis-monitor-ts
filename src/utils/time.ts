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

export interface CheckpointTimeTarget {
  time: string;
  expectedCount: number;
  cron?: string;
  label?: string;
}

export function getCurrentTimeHHMM(
  value: Date | string | null | undefined = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const d = toDate(value) || new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

export function resolveCheckpointForTime<T extends CheckpointTimeTarget>(
  checkpoints: T[],
  value: Date | string | null | undefined = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): T {
  const currentTime = getCurrentTimeHHMM(value, timeZone);
  const sorted = [...checkpoints].sort((a, b) => a.time.localeCompare(b.time));
  let matched: T | null = null;
  for (const cp of sorted) {
    if (currentTime >= cp.time) {
      matched = cp;
    } else {
      break;
    }
  }
  return (
    matched ||
    ({
      time: '00:00',
      cron: '',
      expectedCount: 0,
      label: `Pre-schedule (prior to ${sorted[0]?.time || 'first check'})`,
    } as T)
  );
}

