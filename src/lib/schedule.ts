export type Schedule =
  | { kind: 'interval'; everyMinutes: number }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number };

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function parseSchedule(raw: unknown): Schedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (record.kind === 'interval') {
    const everyMinutes = record.everyMinutes;
    if (typeof everyMinutes !== 'number' || !inRange(everyMinutes, 1, 10080)) return null;
    return { kind: 'interval', everyMinutes };
  }
  if (record.kind === 'daily') {
    const hour = record.hour;
    const minute = record.minute;
    if (typeof hour !== 'number' || typeof minute !== 'number') return null;
    if (!inRange(hour, 0, 23) || !inRange(minute, 0, 59)) return null;
    return { kind: 'daily', hour, minute };
  }
  if (record.kind === 'weekly') {
    const weekday = record.weekday;
    const hour = record.hour;
    const minute = record.minute;
    if (typeof weekday !== 'number' || typeof hour !== 'number' || typeof minute !== 'number') return null;
    if (!inRange(weekday, 0, 6) || !inRange(hour, 0, 23) || !inRange(minute, 0, 59)) return null;
    return { kind: 'weekly', weekday, hour, minute };
  }
  return null;
}

function slot(now: Date, hour: number, minute: number, weekday?: number): Date {
  const due = new Date(now);
  due.setUTCSeconds(0, 0);
  due.setUTCHours(hour, minute, 0, 0);
  if (weekday !== undefined) {
    const delta = (now.getUTCDay() - weekday + 7) % 7;
    due.setUTCDate(due.getUTCDate() - delta);
  }
  if (due.getTime() > now.getTime()) {
    due.setUTCDate(due.getUTCDate() - (weekday === undefined ? 1 : 7));
  }
  return due;
}

export function isDue(schedule: Schedule, lastRunAt: string | null, now: Date): boolean {
  if (schedule.kind === 'interval') {
    if (!lastRunAt) return true;
    const elapsed = now.getTime() - new Date(lastRunAt).getTime();
    return elapsed >= schedule.everyMinutes * 60_000;
  }
  const due =
    schedule.kind === 'daily'
      ? slot(now, schedule.hour, schedule.minute)
      : slot(now, schedule.hour, schedule.minute, schedule.weekday);
  if (now.getTime() < due.getTime()) return false;
  if (!lastRunAt) return true;
  return new Date(lastRunAt).getTime() < due.getTime();
}
