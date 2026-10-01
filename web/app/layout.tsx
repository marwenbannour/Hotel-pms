import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
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
  return { title: DICTS[isLang(lang) ? lang : 'fr'].appName, robots: { index: false } };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#16324f' };

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
