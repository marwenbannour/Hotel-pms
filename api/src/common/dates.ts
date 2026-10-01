import { appConfig } from '../config';

/** Date du jour (YYYY-MM-DD) dans le fuseau de l'établissement. */
export function hotelToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: appConfig.hotel.timezone }).format(now);
}

export function nightsBetween(arrival: string, departure: string): number {
  const ms = Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
