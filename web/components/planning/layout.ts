import { addDays, nightsBetween } from '@/lib/dates';
import type { PlanningStay } from '@/lib/types';

/** Fin effective d'un séjour : un départ en retard occupe la chambre au moins jusqu'à demain. */
export function effectiveEnd(s: PlanningStay, today: string): string {
  return s.overdue ? addDays(today, 1) : s.departureDate;
}

/**
 * Colonnes de grille en demi-journées : un séjour commence au milieu du jour d'arrivée
 * et se termine au milieu du jour de départ, comme sur un planning papier.
 * Renvoie [début, fin] en lignes de grille CSS (base 1), bornées à la période.
 */
export function barColumns(s: PlanningStay, from: string, days: number, today: string): [number, number, boolean, boolean] {
  const start = nightsBetween(from, s.arrivalDate) * 2 + 1;
  const end = nightsBetween(from, effectiveEnd(s, today)) * 2 + 1;
  const clippedStart = start < 0;
  const clippedEnd = end > days * 2;
  return [Math.max(start, 0) + 1, Math.min(end, days * 2) + 1, clippedStart, clippedEnd];
}

export const overlaps = (a: PlanningStay, b: PlanningStay, today: string) =>
  a.arrivalDate < effectiveEnd(b, today) && b.arrivalDate < effectiveEnd(a, today);

/** Une chambre est libre pour un séjour si aucun autre séjour actif qui y est attribué ne le recoupe. */
export function roomIsFree(roomId: string, stay: PlanningStay, stays: PlanningStay[], today: string) {
  return !stays.some(
    (o) => o.id !== stay.id && o.roomId === roomId && o.status !== 'checked_out' && overlaps(o, stay, today),
  );
}

/** Répartit les séjours sans chambre en couloirs, sans chevauchement visuel. */
export function packLanes(stays: PlanningStay[], today: string): PlanningStay[][] {
  const lanes: PlanningStay[][] = [];
  for (const s of [...stays].sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))) {
    const lane = lanes.find((l) => l.every((o) => !overlaps(o, s, today)));
    if (lane) lane.push(s);
    else lanes.push([s]);
  }
  return lanes;
}
