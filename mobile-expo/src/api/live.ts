import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import EventSource from 'react-native-sse';
import { api, getOrigin } from './client';

/**
 * Synchronisation en direct, comme le web (web/lib/live.ts) : l'API signale chaque modification
 * sur GET /v1/events (Server-Sent Events) et les écrans concernés se rechargent.
 */
type Topic = 'rooms' | 'reservations' | 'billing' | 'guests';

const QUERIES: Record<Topic, readonly string[]> = {
  rooms: ['rooms', 'room-types', 'room'],
  reservations: ['reservations', 'reservation', 'folio'],
  billing: ['folio'],
  guests: ['reservations', 'reservation'],
};

const BATCH_MS = 300;
const OFFLINE_NOTICE_MS = 8_000;
const RETRY_MS = 3_000;
const LIVE_REFRESH_MS = 5 * 60_000;

let connected = false;
let offlineShown = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useLive = () => useSyncExternalStore(subscribe, () => connected);
/** Vrai quand la connexion est perdue depuis plusieurs secondes (bandeau). */
export const useOffline = () => useSyncExternalStore(subscribe, () => offlineShown);
/** Actualisation de secours : longue quand le flux est actif, `fallbackMs` sinon. */
export const useRefreshInterval = (fallbackMs: number) => (useLive() ? LIVE_REFRESH_MS : fallbackMs);

function invalidate(qc: QueryClient, topics: Set<Topic>) {
  const roots = new Set<unknown>(['dashboard']);
  for (const t of topics) QUERIES[t]?.forEach((k) => roots.add(k));
  qc.invalidateQueries({ predicate: (q) => roots.has(q.queryKey[0]) });
}

/** Flux ouvert tant que l'application est au premier plan et la session ouverte. */
export function useLiveUpdates(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource<'ready' | 'change' | 'ping'> | null = null;
    let offlineTimer: ReturnType<typeof setTimeout> | undefined;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let loadedOnce = false;
    let pending = new Set<Topic>();

    const setConnected = (value: boolean) => {
      if (value) {
        clearTimeout(offlineTimer);
        offlineTimer = undefined;
        offlineShown = false;
      } else if (!offlineTimer && !offlineShown) {
        offlineTimer = setTimeout(() => {
          offlineShown = true;
          notify();
        }, OFFLINE_NOTICE_MS);
      }
      connected = value;
      notify();
    };

    const open = () => {
      if (source) return;
      const es = new EventSource<'ready' | 'change' | 'ping'>(`${getOrigin()}/api/v1/events`, {
        withCredentials: true,
        pollingInterval: RETRY_MS,
        timeoutBeforeConnection: 0,
      });
      source = es;
      es.addEventListener('ready', () => {
        setConnected(true);
        // Reconnexion : tout recharger pour rattraper ce qui a pu être manqué.
        if (loadedOnce) qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'navigation' });
        loadedOnce = true;
      });
      es.addEventListener('change', (e) => {
        try {
          const notice = JSON.parse(e.data ?? '{}') as { topics?: Topic[] };
          notice.topics?.forEach((t) => pending.add(t));
        } catch {
          return;
        }
        batchTimer ??= setTimeout(() => {
          batchTimer = undefined;
          const topics = pending;
          pending = new Set();
          invalidate(qc, topics);
        }, BATCH_MS);
      });
      es.addEventListener('error', (e) => {
        setConnected(false);
        // Session perdue : ne pas réessayer en boucle, vérifier la session (retour à la connexion).
        if ('xhrStatus' in e && e.xhrStatus === 401) {
          close();
          api('/me').catch(() => undefined);
        }
      });
      es.addEventListener('close', () => setConnected(false));
    };

    const close = () => {
      source?.removeAllEventListeners();
      source?.close();
      source = null;
    };

    open();
    // Arrière-plan ou téléphone verrouillé : flux fermé (batterie), rouvert au retour.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') open();
      else {
        close();
        clearTimeout(offlineTimer);
        offlineTimer = undefined;
        connected = false;
        notify();
      }
    });
    return () => {
      sub.remove();
      clearTimeout(offlineTimer);
      clearTimeout(batchTimer);
      close();
      connected = false;
      offlineShown = false;
      notify();
    };
  }, [enabled, qc]);
}
