'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/lang-context';
import { dirOf } from '@/lib/i18n';

export interface Bar {
  key: string;
  value: number;
  /** Libellé d'axe ; vide pour ne pas l'afficher (étiquetage sélectif). */
  axisLabel: string;
  tooltipTitle: string;
  tooltipLines: string[];
  forecast: boolean;
}

/**
 * Histogramme à une série en HTML : l'axe du temps s'inverse naturellement en arabe.
 * Grille en traits fins pleins, valeurs au survol ou au focus (clavier).
 */
export function BarChart({
  bars,
  max,
  gridlines,
  formatTick,
  label,
}: {
  bars: Bar[];
  max: number;
  gridlines: number[];
  formatTick: (v: number) => string;
  label: string;
}) {
  const { lang } = useI18n();
  const rtl = dirOf(lang) === 'rtl';
  const [active, setActive] = useState<number | null>(null);
  const hovered = active === null ? null : bars[active];
  const gap = bars.length > 40 ? 'gap-px' : 'gap-[2px]';

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <div className="relative">
        {gridlines.map((v) => (
          <div
            key={v}
            className="pointer-events-none absolute inset-x-0 border-t border-line"
            style={{ bottom: `${(v / max) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -top-2.5 end-0 bg-surface ps-1 text-[11px] leading-4 text-ink-faint">{formatTick(v)}</span>
          </div>
        ))}
        <div className={`relative flex h-48 items-end border-b border-line pe-14 ${gap}`} role="list" aria-label={label}>
          {bars.map((b, i) => (
            <div
              key={b.key}
              role="listitem"
              tabIndex={0}
              aria-label={`${b.tooltipTitle} : ${b.tooltipLines.join(', ')}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group flex h-full min-w-0 flex-1 cursor-default flex-col justify-end focus-visible:outline-none"
            >
              <div
                className={`min-h-[2px] rounded-t-[4px] transition-opacity ${b.forecast ? 'forecast' : 'bg-ink'} ${
                  active !== null && active !== i ? 'opacity-50' : ''
                } group-focus-visible:ring-2 group-focus-visible:ring-brass`}
                style={{ height: `${max > 0 ? Math.min(100, (b.value / max) * 100) : 0}%` }}
              />
            </div>
          ))}
        </div>
        {hovered && active !== null && (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 w-max max-w-[14rem] rounded-md bg-surface px-3 py-2 text-[13px] shadow-lg ring-1 ring-line"
            style={{
              bottom: `calc(${max > 0 ? Math.min(100, (hovered.value / max) * 100) : 0}% + 0.5rem)`,
              // Centré sur la barre (zone de tracé = largeur moins la marge des graduations), sans déborder.
              insetInlineStart: `clamp(0px, calc((100% - 3.5rem) * ${(active + 0.5) / bars.length} - 3.5rem), calc(100% - 14rem))`,
            }}
          >
            <p className="font-medium text-ink">{hovered.tooltipTitle}</p>
            {hovered.tooltipLines.map((l) => (
              <p key={l} className="text-ink-soft" dir={rtl ? 'rtl' : 'ltr'}>{l}</p>
            ))}
          </div>
        )}
      </div>
      <div className={`mt-1.5 flex pe-14 text-[11px] text-ink-faint ${gap}`} aria-hidden>
        {bars.map((b) => (
          <span key={b.key} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">{b.axisLabel}</span>
        ))}
      </div>
    </div>
  );
}
