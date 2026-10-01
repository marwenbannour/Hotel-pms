import { createHash } from 'crypto';
import type { Lang } from '../../common/i18n';

/** TVA incluse dans un montant TTC (taux en points de base) : arrondi au centime par ligne. */
export const vatOf = (amountTtc: number, rate: number) => Math.round((amountTtc * rate) / (10000 + rate));

/** Sérialisation à clés triées : l'ordre des clés jsonb renvoyé par PostgreSQL ne change pas l'empreinte. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Détecte un numéro de carte (13 à 19 chiffres valides selon Luhn) saisi par erreur. */
export function looksLikeCardNumber(text: string): boolean {
  for (const m of text.replace(/[ -]/g, '').match(/\d{13,19}/g) ?? []) {
    let sum = 0;
    for (let i = 0; i < m.length; i++) {
      let d = Number(m[m.length - 1 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}

const BOARD: Record<Lang, Record<string, string>> = {
  fr: { room_only: 'nuitée', half_board: 'demi-pension', full_board: 'pension complète' },
  en: { room_only: 'room only', half_board: 'half board', full_board: 'full board' },
  ar: { room_only: 'مبيت فقط', half_board: 'نصف إقامة', full_board: 'إقامة كاملة' },
};

/**
 * Date de libellé selon la langue, isolée par des marqueurs Unicode (LRI … PDI) :
 * dans un texte arabe, l'algorithme bidirectionnel ne peut plus en réordonner les chiffres.
 */
export function lineDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-');
  void lang; // même format JJ/MM/AAAA dans les trois langues ; paramètre conservé pour un format par pays
  return `\u2066${d}/${m}/${y}\u2069`;
}

export const LINE_TEXT: Record<Lang, {
  stay: (type: string, nights: number, board: string, from: string, to: string) => string;
  touristTax: (adults: number, nights: number) => string;
}> = {
  fr: {
    stay: (t, n, b, f, to) => `Hébergement – ${t}, ${n} nuit${n > 1 ? 's' : ''} (du ${lineDate(f, 'fr')} au ${lineDate(to, 'fr')}), ${BOARD.fr[b]}`,
    touristTax: (a, n) => `Taxe de séjour – ${a} adulte${a > 1 ? 's' : ''} × ${n} nuit${n > 1 ? 's' : ''}`,
  },
  en: {
    stay: (t, n, b, f, to) => `Accommodation – ${t}, ${n} night${n > 1 ? 's' : ''} (${lineDate(f, 'en')} to ${lineDate(to, 'en')}), ${BOARD.en[b]}`,
    touristTax: (a, n) => `Tourist tax – ${a} adult${a > 1 ? 's' : ''} × ${n} night${n > 1 ? 's' : ''}`,
  },
  ar: {
    stay: (t, n, b, f, to) => `الإقامة – \u2068${t}\u2069، عدد الليالي: ${n} (من ${lineDate(f, 'ar')} إلى ${lineDate(to, 'ar')})، ${BOARD.ar[b]}`,
    touristTax: (a, n) => `ضريبة الإقامة – البالغون: ${a} × الليالي: ${n}`,
  },
};

/**
 * TypeORM renvoie [lignes, nombre] pour UPDATE/DELETE … RETURNING, mais les lignes seules pour
 * SELECT/INSERT : cette fonction renvoie toujours les lignes.
 */
export function returnedRows<T>(result: unknown): T[] {
  return (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number'
    ? result[0]
    : result) as T[];
}
