import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LANG_COOKIE } from '@/lib/i18n';
import { RT_COOKIE } from '@/lib/server/session';
import { Shell } from './shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  if (!jar.get(RT_COOKIE)) redirect('/login');
  return <Shell langChosen={!!jar.get(LANG_COOKIE)}>{children}</Shell>;
}
