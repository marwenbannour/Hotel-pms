/**
 * Génère src/theme/tokens.ts à partir de design/tokens.json, copie des tokens de la charte
 * HOTELIA. À relancer après chaque mise à jour de la charte :
 *   npm run theme
 *
 * - Couleurs : une palette par thème, alias ({ink}) résolus.
 * - Longueurs en px → nombres (React Native n'a pas d'unités).
 * - Ombres CSS → ombre iOS (shadow*) + elevation Android.
 * - Styles de texte → TextStyle, avec la famille de la bonne graisse (en React Native, une
 *   graisse est une famille : Poppins_600SemiBold) ; variante arabe en Noto Kufi Arabic.
 * - Durées d'animation en ms.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8'));

const px = (v) => {
  if (typeof v === 'number') return v;
  const m = /^(-?[\d.]+)px$/.exec(String(v).trim());
  if (!m) throw new Error(`Longueur non convertible : ${v}`);
  return Number(m[1]);
};
const camel = (name) => name.replace(/[-.]([a-z0-9])/g, (_, c) => c.toUpperCase());

// Couleurs par thème, alias résolus.
const themes = tokens.color.themes.map((t) => t.id);
const byName = new Map(tokens.color.tokens.map((t) => [t.name, t]));
function colorOf(name, theme, depth = 0) {
  if (depth > 16) throw new Error(`Alias trop profond : ${name}`);
  const tok = byName.get(name);
  if (!tok) throw new Error(`Couleur inconnue : ${name}`);
  const raw = typeof tok.value === 'string' ? tok.value : (tok.value[theme] ?? tok.value[themes[0]]);
  const alias = /^\{(.+)\}$/.exec(raw);
  return alias ? colorOf(alias[1], theme, depth + 1) : raw;
}
const colors = Object.fromEntries(themes.map((theme) => [theme, Object.fromEntries(tokens.color.tokens.map((t) => [camel(t.name), colorOf(t.name, theme)]))]));

// Échelles.
const scale = (family, prefix) =>
  Object.fromEntries((tokens[family]?.tokens ?? []).map((t) => [camel(t.name.replace(new RegExp(`^${prefix}-`), '')), px(t.value)]));
const space = scale('spacing', 'space');
const radius = scale('radius', 'radius');
const size = scale('size', '');

// Ombres : première couche CSS → iOS, elevation selon la charte (shadow-lg 4, shadow-xl 8).
const ELEVATION = { 'shadow-1': 1, 'shadow-2': 4, 'shadow-3': 8 };
function shadowOf(css) {
  const m = /^(-?[\d.]+)(?:px)? (-?[\d.]+)(?:px)? ([\d.]+)(?:px)?(?: -?[\d.]+(?:px)?)? rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/.exec(css.trim());
  if (!m) throw new Error(`Ombre non convertible : ${css}`);
  const [, x, y, blur, r, g, b, a] = m;
  return { shadowColor: `rgb(${r}, ${g}, ${b})`, shadowOffset: { width: Number(x), height: Number(y) }, shadowRadius: Number(blur) / 2, shadowOpacity: Number(a) };
}
const shadows = Object.fromEntries(
  themes.map((theme) => [
    theme,
    Object.fromEntries(
      tokens.shadow.tokens.map((t) => {
        const css = typeof t.value === 'string' ? t.value : (t.value[theme] ?? t.value[themes[0]]);
        return [camel(t.name.replace(/^shadow-/, '')), { ...shadowOf(css), elevation: ELEVATION[t.name] ?? 2 }];
      }),
    ),
  ]),
);

// Typographie.
const FAMILY = {
  display: { 400: 'Poppins_400Regular', 500: 'Poppins_500Medium', 600: 'Poppins_600SemiBold', 700: 'Poppins_700Bold' },
  body: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold' },
  arabic: { 400: 'NotoKufiArabic_400Regular', 500: 'NotoKufiArabic_500Medium', 600: 'NotoKufiArabic_600SemiBold', 700: 'NotoKufiArabic_700Bold' },
};
/** Équivalent arabe d'une famille latine, même graisse : l'arabe n'existe ni en Poppins ni en Inter. */
const arabicOf = (fontFamily) => fontFamily.replace(/^(Poppins|Inter)_/, 'NotoKufiArabic_');
const type = {};
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    const fam = s.family ?? group.family;
    const weight = Number(s.fontWeight ?? 400);
    const fontFamily = FAMILY[fam]?.[weight];
    if (!fontFamily) throw new Error(`Pas de police ${fam} ${weight}`);
    type[camel(s.name)] = {
      fontFamily,
      fontSize: px(s.fontSize),
      lineHeight: px(s.lineHeight),
      ...(s.letterSpacing ? { letterSpacing: px(s.letterSpacing) } : {}),
    };
  }
}
// Version arabe de chaque style : même taille, Noto Kufi Arabic, interligne 1,7 (lettres hautes et basses).
const typeArabic = Object.fromEntries(
  Object.entries(type).map(([k, v]) => [k, { ...v, fontFamily: arabicOf(v.fontFamily), lineHeight: Math.max(v.lineHeight, Math.round(v.fontSize * 1.7)), letterSpacing: 0 }]),
);

const duration = Object.fromEntries((tokens.duration?.tokens ?? []).map((t) => [camel(t.name.replace(/^duration-/, '')), Number(/^(\d+)ms$/.exec(t.value)[1])]));

const out = `/* Fichier généré par scripts/generate-theme.mjs depuis design/tokens.json : ne pas modifier à la main. */

export const colors = ${JSON.stringify(colors, null, 2)} as const;

export type ThemeName = keyof typeof colors;
export type Palette = { [K in keyof (typeof colors)['light']]: string };

export const space = ${JSON.stringify(space, null, 2)} as const;

export const radius = ${JSON.stringify(radius, null, 2)} as const;

export const size = ${JSON.stringify(size, null, 2)} as const;

export const shadows = ${JSON.stringify(shadows, null, 2)} as const;

export const type = ${JSON.stringify(type, null, 2)} as const;

export const typeArabic = ${JSON.stringify(typeArabic, null, 2)} as const;

export type TypeStyle = keyof typeof type;

export const duration = ${JSON.stringify(duration, null, 2)} as const;
`;
writeFileSync(resolve(root, 'src/theme/tokens.ts'), out);
console.log(`src/theme/tokens.ts : ${themes.length} thèmes, ${tokens.color.tokens.length} couleurs, ${Object.keys(type).length} styles de texte`);
