'use client';

import { ArrowDownRight, ArrowUpRight, Banknote, BedDouble, CalendarArrowDown, CalendarArrowUp, Sparkles, Users, Wrench } from 'lucide-react';
import { addDays } from '@/lib/dates';
import { useI18n } from '@/lib/lang-context';
import type { Dashboard } from '@/lib/types';
import { CARD, Sparkline } from './card';

type Tone = 'gold' | 'success' | 'warning' | 'info';

/** Pastille de l'icône et couleur de la courbe, par carte. */
const TONES: Record<Tone, { badge: string; line: string }> = {
  gold: { badge: 'bg-gold text-navy', line: 'text-gold' },
  success: { badge: 'bg-available text-white', line: 'text-available' },
  warning: { badge: 'bg-cleaning text-white', line: 'text-cleaning' },
  info: { badge: 'bg-info text-white', line: 'text-info' },
};

interface Kpi {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  tone: Tone;
  /** Évolution par rapport à la veille, déjà mise en forme (« +4,2 pt »). */
  delta?: { text: string; up: boolean; flat: boolean };
  note?: string;
  trend?: number[];
}

/**
 * Chiffres du jour en tête du tableau de bord. Chaque carte n'apparaît que si l'API fournit
 * la donnée au profil : montants pour la direction, mouvements pour la réception, chambres pour le ménage.
 */
export function KpiCards({ data }: { data: Dashboard }) {
  const { t, f } = useI18n(data.kpis?.currency);
  const mv = data.movements;
  const rooms = data.rooms;
  const trend = (data.kpis?.trend ?? []).filter((d) => !d.forecast);
  const yesterday = trend.find((d) => d.date === addDays(data.date, -1));
  const today = data.kpis?.today;

  const occupancy = today?.occupancyRate ?? (rooms && rooms.total ? (rooms.occupied / rooms.total) * 100 : undefined);
  const signed = (v: number, text: string) => ({ text: `${v > 0 ? '+' : ''}${text}`, up: v > 0, flat: Math.abs(v) < 0.05 });

  const cards: (Kpi | false | undefined)[] = [
    occupancy !== undefined && {
      label: t.occupancyRate,
      value: f.percent(occupancy),
      icon: BedDouble,
      tone: 'gold',
      delta: yesterday ? signed(occupancy - yesterday.occupancyRate, `${f.number(occupancy - yesterday.occupancyRate)} ${t.points}`) : undefined,
      note: today ? `${today.roomsSold}/${today.roomsAvailable}` : undefined,
      trend: trend.map((d) => d.occupancyRate),
    },
    today?.revenue !== undefined
      ? {
          label: t.revenueDay,
          value: f.money(today.revenue),
          icon: Banknote,
          tone: 'success',
          delta:
            yesterday && yesterday.revenue > 0
              ? signed(today.revenue - yesterday.revenue, f.percent(((today.revenue - yesterday.revenue) / yesterday.revenue) * 100))
              : undefined,
          trend: trend.map((d) => d.revenue),
        }
      : mv && { label: t.inHouse, value: mv.inHouse, icon: Users, tone: 'success' },
    mv && {
      label: t.arrivalsToday,
      value: mv.arrivals.length,
      icon: CalendarArrowDown,
      tone: 'warning',
      note: `${mv.arrivalsPending} ${t.arrivalsPending}`,
    },
    mv && {
      label: t.departuresToday,
      value: mv.departures.length,
      icon: CalendarArrowUp,
      tone: 'info',
      note: `${mv.departuresPending} ${t.departuresPending}`,
    },
    // Ménage (sans mouvements) : les chambres à traiter.
    !mv && rooms && { label: t.statuses.cleaning, value: rooms.cleaning, icon: Sparkles, tone: 'warning' },
    !mv && rooms && { label: t.statuses.maintenance, value: rooms.maintenance, icon: Wrench, tone: 'info' },
    !mv && rooms && { label: t.statuses.available, value: rooms.available, icon: BedDouble, tone: 'success' },
  ];
  const shown = cards.filter(Boolean) as Kpi[];
  if (shown.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {shown.map((k) => {
        const tone = TONES[k.tone];
        const Arrow = k.delta?.up ? ArrowUpRight : ArrowDownRight;
        return (
          <li key={k.label} className={`${CARD} flex flex-col gap-3 p-5`}>
            <div className="flex items-start gap-4">
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
                <k.icon className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-soft first-letter:uppercase">{k.label}</p>
                <p className="font-display text-[26px] leading-9 font-semibold">{k.value}</p>
                {k.delta ? (
                  <p
                    className={`flex items-center gap-1 text-[13px] font-medium ${
                      k.delta.flat ? 'text-ink-soft' : k.delta.up ? 'text-available-text' : 'text-maintenance'
                    }`}
                  >
                    {!k.delta.flat && <Arrow className="size-4 rtl:-scale-x-100" aria-hidden />}
                    <span>
                      {k.delta.text} <span className="font-normal text-ink-soft">{t.vsYesterday}</span>
                    </span>
                  </p>
                ) : (
                  k.note && <p className="text-[13px] text-ink-soft">{k.note}</p>
                )}
              </div>
            </div>
            {k.trend && <Sparkline values={k.trend} className={tone.line} />}
          </li>
        );
      })}
    </ul>
  );
}
