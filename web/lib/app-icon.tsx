/**
 * Icône de l'application installée : une étiquette de clé d'hôtel, laiton sur encre.
 * Rendue en PNG par next/og (aucun fichier binaire dans le dépôt).
 */
export const INK = '#0d182a';
export const PAPER = '#f6f7f9';
const BRASS = '#c8912e';

/**
 * `safe` réduit le motif à la zone sûre des icônes « maskable » (cercle de 80 %) : Android
 * découpe l'icône selon la forme du lanceur.
 */
export function AppIcon({ size, safe = false }: { size: number; safe?: boolean }) {
  const glyph = Math.round(size * (safe ? 0.5 : 0.66));
  return (
    <div style={{ width: size, height: size, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={glyph} height={glyph} viewBox="0 0 64 64">
        {/* Étiquette de clé : corps arrondi, œillet, anneau */}
        <path d="M14 22 L32 6 L50 22 L50 54 Q50 58 46 58 L18 58 Q14 58 14 54 Z" fill={BRASS} />
        <circle cx="32" cy="20" r="5" fill={INK} />
        <rect x="22" y="32" width="20" height="4" rx="2" fill={INK} />
        <rect x="22" y="41" width="20" height="4" rx="2" fill={INK} />
        <rect x="22" y="50" width="12" height="4" rx="2" fill={INK} />
      </svg>
    </div>
  );
}
