'use client';

import { useEffect } from 'react';

/** Enregistre le service worker (page « pas de connexion » de l'application installée). */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
}
