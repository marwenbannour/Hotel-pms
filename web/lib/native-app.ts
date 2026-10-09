'use client';

import { useSyncExternalStore } from 'react';

/** Marque ajoutée à l'agent utilisateur par l'application Android (mobile/capacitor.config.json). */
const APP_MARKER = 'HotelPMSApp/';

/**
 * Lanceur de l'application Android (page locale de l'application) : y revenir permet de saisir
 * l'adresse d'un autre serveur.
 */
export const CHANGE_SERVER_URL = 'https://localhost/?change=1';

/**
 * Marque des écrans web affichés à l'intérieur de l'application native (mobile-expo) : la page
 * n'a alors ni menu ni barre d'onglets, l'application fournit les siens.
 */
const NATIVE_MARKER = 'HotelPMSNative/';

const useUserAgentHas = (marker: string) =>
  useSyncExternalStore(
    () => () => {},
    () => navigator.userAgent.includes(marker),
    () => false,
  );

/** Vrai dans l'application Android, faux dans un navigateur (et au rendu serveur). */
export function useInAndroidApp(): boolean {
  return useUserAgentHas(APP_MARKER);
}

/** Vrai quand la page est un écran de l'application native : contenu seul, sans navigation. */
export function useInNativeShell(): boolean {
  return useUserAgentHas(NATIVE_MARKER);
}
