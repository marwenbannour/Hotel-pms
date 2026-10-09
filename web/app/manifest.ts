import type { MetadataRoute } from 'next';
import { cookies } from 'next/headers';
import { INK, PAPER } from '@/lib/app-icon';
import { DICTS, dirOf, isLang, LANG_COOKIE } from '@/lib/i18n';

/**
 * Application installable sur téléphone (écran d'accueil, plein écran). Le nom suit la langue
 * choisie au moment de l'installation.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const raw = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(raw) ? raw : 'fr';
  const t = DICTS[lang];
  return {
    id: '/',
    name: t.appName,
    short_name: t.appShortName,
    description: t.appDescription,
    lang,
    dir: dirOf(lang),
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: PAPER,
    theme_color: INK,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
