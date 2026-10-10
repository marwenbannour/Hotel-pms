import { I18nManager } from 'react-native';

/**
 * Langue du téléphone (« fr », « en », « ar »…), lue par React Native.
 * Pas d'expo-localization : son module natif remet le sens de lecture à zéro à chaque démarrage,
 * ce qui empêcherait l'arabe (choisi par le profil) de passer de droite à gauche.
 */
export function deviceLanguage(): string | undefined {
  const id = I18nManager.getConstants().localeIdentifier ?? Intl.DateTimeFormat().resolvedOptions().locale;
  return id?.split(/[-_]/)[0]?.toLowerCase();
}
