import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'serverUrl';
const TIMEOUT_MS = 8000;

/** Marque de l'application ajoutée à l'agent utilisateur des WebView. */
export const USER_AGENT_SUFFIX = 'HotelPMSApp/1.0 (Expo)';

/**
 * Écrans web affichés dans l'application native : l'application web masque alors son propre
 * menu et sa barre d'onglets (web/lib/native-app.ts).
 */
export const NATIVE_USER_AGENT = `${USER_AGENT_SUFFIX} HotelPMSNative/1`;

export const loadServer = () => AsyncStorage.getItem(KEY).catch(() => null);
export const saveServer = (origin: string) => AsyncStorage.setItem(KEY, origin);

/**
 * « 192.168.1.10:3001 » → http://192.168.1.10:3001 ; « pms.hotel.com » → https://pms.hotel.com.
 * Seule l'origine est gardée : l'application s'ouvre toujours à la racine.
 */
export function normalizeServer(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    const host = value.split('/')[0];
    const local = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/i.test(host) || /\.local(:\d+)?$/i.test(host);
    value = `${local ? 'http' : 'https'}://${value}`;
  }
  const match = /^(https?):\/\/([^/?#:]+)(:\d+)?/i.exec(value);
  return match ? `${match[1].toLowerCase()}://${match[2].toLowerCase()}${match[3] ?? ''}` : null;
}

export type CheckResult = 'ok' | 'unreachable' | 'notPms';

/** Vérifie que le serveur répond et qu'il s'agit bien de l'application de gestion (manifeste). */
export async function checkServer(origin: string): Promise<CheckResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/manifest.webmanifest`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    const manifest = (await res.json()) as { start_url?: string; display?: string };
    return res.ok && manifest.start_url === '/' && manifest.display === 'standalone' ? 'ok' : 'notPms';
  } catch (e) {
    // Réponse reçue mais illisible (page HTML, autre service) : ce n'est pas l'application.
    return e instanceof SyntaxError ? 'notPms' : 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}
