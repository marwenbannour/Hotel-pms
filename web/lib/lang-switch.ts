'use client';

import { Lang, LANG_COOKIE } from './i18n';

export function persistLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}
