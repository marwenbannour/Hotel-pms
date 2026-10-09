import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import { api } from './client';
import type { Me, MenuEntry } from './types';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: async () => (await api<Me>('/me')).data, staleTime: 5 * 60_000, retry: false });
}

export function useCan() {
  const me = useMe();
  return (permission: string) => !!me.data?.permissions.includes(permission);
}

/** Menu du profil, filtré par l'API selon les droits et les modules, traduit dans sa langue. */
export function useNavigationMenu() {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ['navigation', lang],
    queryFn: async () => (await api<{ items: MenuEntry[] }>('/me/navigation')).data.items,
    staleTime: 5 * 60_000,
  });
}

/** Entrées du menu qui mènent à un écran, dans l'ordre du menu (groupes dépliés). */
export function leaves(items: MenuEntry[]): MenuEntry[] {
  return items.flatMap((i) => [...(i.path ? [i] : []), ...leaves(i.children)]);
}
