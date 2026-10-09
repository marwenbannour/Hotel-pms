'use client';

import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';

/** Familles de données signalées par l'API (GET /v1/events). */
type Topic = 'rooms' | 'reservations' | 'billing' | 'guests';

interface ChangeNotice {
  topics: Topic[];
  id?: string;
  at: string;
}

/**
 * Requêtes (premier élément de la clé) à recharger pour chaque sujet. Le tableau de bord
 * dépend de tout : il est rechargé à chaque changement, même sans sujet lisible.
 * Seules les requêtes affichées sont refaites ; les autres sont marquées périmées.
 */
const QUERIES: Record<Topic, readonly string[]> = {
  rooms: ['rooms', 'room-types', 'planning'],
  reservations: ['reservations', 'reservation', 'planning', 'folio', 'guest', 'reports'],
  billing: ['folio', 'invoices', 'invoice', 'reports'],
  guests: ['guests', 'guest', 'reservation', 'reservations'],
};

/** Regroupe les changements rapprochés (une arrivée en émet plusieurs) en un seul rechargement. */
const BATCH_MS = 300;
/** En deçà, une coupure (reconnexion à l'expiration du jeton) ne s'affiche pas. */
const OFFLINE_NOTICE_MS = 8_000;
const RETRY_MIN_MS = 3_000;
const RETRY_MAX_MS = 60_000;

/** Intervalle de secours quand le flux est actif : seules les alertes liées à l'heure en dépendent. */
const LIVE_REFRESH_MS = 5 * 60_000;

// État de la connexion, partagé par les écrans (bandeau, intervalle d'actualisation).
let connected = false;
let offlineShown = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Vrai quand les modifications arrivent en direct. */
export function useLive(): boolean {
  return useSyncExternalStore(subscribe, () => connected, () => false);
}

/** Vrai quand la connexion est perdue depuis plusieurs secondes (bandeau « hors ligne »). */
export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, () => offlineShown, () => false);
}

/**
 * Intervalle d'actualisation d'un écran qui reste ouvert : long quand le flux est actif,
 * `fallbackMs` sinon (flux coupé, proxy qui ne laisse pas passer les événements).
 */
export function useRefreshInterval(fallbackMs: number): number {
  return useLive() ? LIVE_REFRESH_MS : fallbackMs;
}

function invalidate(qc: QueryClient, topics: Set<Topic>) {
  const roots = new Set<unknown>(['dashboard']);
  for (const t of topics) QUERIES[t]?.forEach((k) => roots.add(k));
  qc.invalidateQueries({ predicate: (q) => roots.has(q.queryKey[0]) });
}

/** Tout recharger sauf le profil et le menu, qui ne dépendent pas des données de l'hôtel. */
function invalidateAll(qc: QueryClient) {
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'navigation' });
}

/**
 * Abonnement au flux des modifications, une connexion par onglet. Monté une fois dans le shell.
 * - `change` : recharge les écrans concernés (regroupés sur 300 ms).
 * - `ready` : à chaque reconnexion, tout est rechargé pour rattraper ce qui a pu être manqué.
 * - Onglet masqué ou téléphone verrouillé : le flux est fermé (batterie, limite de connexions
 *   du navigateur) et rouvert au retour, avec rechargement.
 * - L'API ferme le flux à l'expiration du jeton d'accès ; le navigateur se reconnecte et le proxy
 *   renouvelle le jeton. Si la session est perdue, l'appel à /me renvoie vers la connexion.
 */
export function useLiveUpdates() {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let offlineTimer: ReturnType<typeof setTimeout> | undefined;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = RETRY_MIN_MS;
    // Au premier chargement, les écrans viennent de lire leurs données : inutile de les recharger.
    let loadedOnce = false;
    let pending = new Set<Topic>();

    const setConnected = (value: boolean) => {
      if (value) {
        clearTimeout(offlineTimer);
        offlineTimer = undefined;
      } else if (!offlineTimer && !offlineShown) {
        offlineTimer = setTimeout(() => {
          offlineShown = true;
          notify();
        }, OFFLINE_NOTICE_MS);
      }
      const changed = connected !== value || (value && offlineShown);
      connected = value;
      if (value) offlineShown = false;
      if (changed) notify();
    };

    const flush = () => {
      batchTimer = undefined;
      const topics = pending;
      pending = new Set();
      invalidate(qc, topics);
    };

    const open = () => {
      clearTimeout(retryTimer);
      if (source || document.hidden) return;
      const es = new EventSource('/api/v1/events');
      source = es;

      es.addEventListener('ready', () => {
        retryMs = RETRY_MIN_MS;
        setConnected(true);
        if (loadedOnce) invalidateAll(qc);
        loadedOnce = true;
      });
      es.addEventListener('change', (e) => {
        let notice: ChangeNotice;
        try {
          notice = JSON.parse((e as MessageEvent<string>).data);
        } catch {
          return;
        }
        notice.topics.forEach((t) => pending.add(t));
        batchTimer ??= setTimeout(flush, BATCH_MS);
      });
      es.onerror = () => {
        setConnected(false);
        // CONNECTING : coupure réseau ou fin normale du flux, le navigateur se reconnecte seul.
        if (es.readyState !== EventSource.CLOSED) return;
        // CLOSED : réponse en erreur (session perdue, API indisponible). On vérifie la session
        // (redirection vers la connexion si elle a expiré) puis on réessaie, de plus en plus tard.
        close();
        api('/me').catch(() => undefined);
        retryTimer = setTimeout(open, retryMs);
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      };
    };

    const close = () => {
      source?.close();
      source = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(retryTimer);
        close();
        loadedOnce = true;
        // Masqué n'est pas hors ligne : pas de bandeau au retour sur l'écran.
        clearTimeout(offlineTimer);
        offlineTimer = undefined;
        connected = false;
        notify();
      } else {
        retryMs = RETRY_MIN_MS;
        open();
      }
    };
    const onOnline = () => {
      retryMs = RETRY_MIN_MS;
      if (!source) open();
    };

    open();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      clearTimeout(retryTimer);
      clearTimeout(offlineTimer);
      clearTimeout(batchTimer);
      close();
      connected = false;
      offlineShown = false;
      notify();
    };
  }, [qc]);
}
