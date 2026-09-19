import type { DateKey, Instant } from './types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** `yyyy-MM-dd` in local time — never `toISOString()`, which silently shifts to UTC. */
export function dateKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MINUTE);
}

/** Monday-anchored week start. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // Mon = 0
  return addDays(s, -dow);
}

export function at(day: Date, hour: number, minute = 0): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

export function iso(d: Date): Instant {
  return d.toISOString();
}

export function minutesBetween(a: Date | string, b: Date | string): number {
  const start = typeof a === 'string' ? new Date(a) : a;
  const end = typeof b === 'string' ? new Date(b) : b;
  return Math.round((end.getTime() - start.getTime()) / MINUTE);
}

export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function dayLabel(d: Date | DateKey): string {
  const date = typeof d === 'string' ? fromDateKey(d) : d;
  return DAY_LABELS[date.getDay()];
}

export function shortDate(d: Date | DateKey): string {
  const date = typeof d === 'string' ? fromDateKey(d) : d;
  return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
}

/** `7:30 PM` — stable across server and client because it never uses Intl locales. */
export function clockTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function relativeDay(key: DateKey, today: DateKey): string {
  const diff = Math.round(
    (fromDateKey(key).getTime() - fromDateKey(today).getTime()) / DAY,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return dayLabel(key);
  return shortDate(key);
}

export function daysAgo(instant: Instant, now: Date): number {
  return Math.floor((now.getTime() - new Date(instant).getTime()) / DAY);
}

export function timeAgo(instant: Instant, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(instant).getTime()) / MINUTE));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic 0–1 pseudo-random from a string seed. Seed data must be stable
 * across server renders, so `Math.random()` is never used.
 */
export function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function seededInt(seed: string, min: number, max: number): number {
  return min + Math.floor(seededUnit(seed) * (max - min + 1));
}
