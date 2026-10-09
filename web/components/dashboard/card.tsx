import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

/** Carte du tableau de bord (charte HOTELIA : surface blanche, coins arrondis, ombre légère). */
export const CARD = 'rounded-2xl bg-surface ring-1 ring-line shadow-[0_1px_2px_rgba(13,24,42,0.05)]';

export function CardTitle({ id, children, action }: { id?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="text-[17px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Lien « Voir… » en bas de carte, affiché seulement si le profil a accès à l'écran. */
export function CardLink({ href, allowed, children }: { href: string; allowed: Set<string>; children: React.ReactNode }) {
  if (!allowed.has(href)) return null;
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:text-brass">
      {children}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

/** Courbe miniature (tendance) ; l'axe du temps suit le sens de lecture. */
export function Sparkline({ values, className }: { values: number[]; className: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`h-8 w-full rtl:-scale-x-100 ${className}`} aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
