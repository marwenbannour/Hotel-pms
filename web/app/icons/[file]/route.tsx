import { ImageResponse } from 'next/og';
import { AppIcon } from '@/lib/app-icon';

/** Icônes du manifeste et de l'écran d'accueil iOS, générées à la construction. */
const ICONS: Record<string, { size: number; safe?: boolean }> = {
  'icon-192.png': { size: 192 },
  'icon-512.png': { size: 512 },
  'maskable-512.png': { size: 512, safe: true },
  'apple-touch-icon.png': { size: 180 },
};

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(ICONS).map((file) => ({ file }));

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const icon = ICONS[(await ctx.params).file];
  if (!icon) return new Response(null, { status: 404 });
  return new ImageResponse(<AppIcon {...icon} />, { width: icon.size, height: icon.size });
}
