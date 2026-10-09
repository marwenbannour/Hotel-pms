/**
 * Copie les dictionnaires de l'application web (web/lib/i18n*.ts) dans src/i18n/shared/ :
 * une seule source pour les textes, partagés par le web et le mobile.
 *   npm run i18n
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, '../web/lib');
mkdirSync(resolve(root, 'src/i18n/shared'), { recursive: true });

const COPIES = [
  ...['i18n.ts', 'i18n-res.ts', 'i18n-housekeeping.ts', 'i18n-billing.ts'].map((file) => [file, `src/i18n/shared/${file}`]),
  // Types des réponses de l'API, partagés eux aussi.
  ['types.ts', 'src/api/types.ts'],
];
mkdirSync(resolve(root, 'src/api'), { recursive: true });
for (const [file, dest] of COPIES) {
  const src = readFileSync(resolve(from, file), 'utf8');
  writeFileSync(resolve(root, dest), `/* Copié de web/lib/${file} par scripts/sync-i18n.mjs : modifier l'original, puis npm run i18n. */\n${src}`);
  console.log(dest);
}
