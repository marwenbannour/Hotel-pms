/**
 * Fichier CSV lisible par Excel en français : UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF.
 * Les champs contenant un séparateur, un guillemet ou un retour à la ligne sont entre guillemets.
 */
export function downloadCsv(filename: string, head: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head, ...rows].map((r) => r.map(cell).join(';'));
  const blob = new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
