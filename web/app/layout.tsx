import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { DICTS, dirOf, isLang, LANG_COOKIE } from '@/lib/i18n';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const lang = (await cookies()).get(LANG_COOKIE)?.value;
  const t = DICTS[isLang(lang) ? lang : 'fr'];
  return {
    title: t.appName,
    robots: { index: false },
    // Ajout à l'écran d'accueil sur iOS (le manifeste n'y suffit pas).
    appleWebApp: { capable: true, title: t.appShortName, statusBarStyle: 'default' },
    icons: { apple: '/icons/apple-touch-icon.png' },
  };
}

/** viewportFit cover : l'application installée occupe tout l'écran, encoches comprises (marges safe-area). */
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d182a', viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const raw = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(raw) ? raw : 'fr';
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="min-h-screen font-sans text-[15px] leading-6">
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
