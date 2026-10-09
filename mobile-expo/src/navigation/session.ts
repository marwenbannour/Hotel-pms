import { createContext, useContext } from 'react';

/** Actions de session offertes aux écrans (profil, connexion). */
export interface SessionActions {
  origin: string;
  signOut: () => void;
  changeServer: () => void;
}

export const SessionContext = createContext<SessionActions>({ origin: '', signOut: () => undefined, changeServer: () => undefined });
export const useSession = () => useContext(SessionContext);
