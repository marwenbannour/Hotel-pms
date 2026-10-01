import { ErrorCode } from './problem';

export const LANGS = ['fr', 'en', 'ar'] as const;
export type Lang = (typeof LANGS)[number];

/** Choisit la langue à partir d'Accept-Language (fr par défaut). */
export function pickLang(header?: string | string[]): Lang {
  const raw = Array.isArray(header) ? header.join(',') : header ?? '';
  const ranked = raw
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .filter((x) => x.lang)
    .sort((a, b) => b.q - a.q);
  const hit = ranked.find((x) => (LANGS as readonly string[]).includes(x.lang));
  return (hit?.lang as Lang) ?? 'fr';
}

const T: Record<ErrorCode, Record<Lang, string>> = {
  VALIDATION_FAILED: { fr: 'Données invalides', en: 'Invalid data', ar: 'بيانات غير صالحة' },
  BAD_REQUEST: { fr: 'Requête mal formée', en: 'Malformed request', ar: 'طلب غير صحيح' },
  UNAUTHENTICATED: { fr: 'Authentification requise', en: 'Authentication required', ar: 'المصادقة مطلوبة' },
  INVALID_CREDENTIALS: { fr: 'Identifiants incorrects', en: 'Invalid credentials', ar: 'بيانات الدخول غير صحيحة' },
  INVALID_TOKEN: { fr: 'Jeton invalide ou expiré', en: 'Invalid or expired token', ar: 'رمز غير صالح أو منتهي الصلاحية' },
  MFA_REQUIRED: { fr: 'Double authentification requise', en: 'Multi-factor authentication required', ar: 'المصادقة الثنائية مطلوبة' },
  MFA_INVALID_CODE: { fr: 'Code de vérification incorrect', en: 'Invalid verification code', ar: 'رمز التحقق غير صحيح' },
  FORBIDDEN: { fr: 'Droits insuffisants', en: 'Insufficient permissions', ar: 'صلاحيات غير كافية' },
  NOT_FOUND: { fr: 'Ressource introuvable', en: 'Resource not found', ar: 'المورد غير موجود' },
  NO_AVAILABILITY: { fr: 'Aucune disponibilité', en: 'No availability', ar: 'لا يوجد توفر' },
  ROOM_UNAVAILABLE: { fr: 'Chambre indisponible', en: 'Room unavailable', ar: 'الغرفة غير متاحة' },
  INVALID_STATE: { fr: 'Opération impossible dans l’état actuel', en: 'Operation not allowed in current state', ar: 'العملية غير مسموحة في الحالة الحالية' },
  CONFLICT: { fr: 'Conflit', en: 'Conflict', ar: 'تعارض' },
  PRECONDITION_REQUIRED: { fr: 'En-tête If-Match requis', en: 'If-Match header required', ar: 'الترويسة If-Match مطلوبة' },
  PRECONDITION_FAILED: { fr: 'Ressource modifiée entre-temps', en: 'Resource modified in the meantime', ar: 'تم تعديل المورد في هذه الأثناء' },
  IDEMPOTENCY_KEY_MISSING: { fr: 'En-tête Idempotency-Key requis', en: 'Idempotency-Key header required', ar: 'الترويسة Idempotency-Key مطلوبة' },
  IDEMPOTENCY_KEY_REUSED: { fr: 'Clé d’idempotence déjà utilisée pour une autre requête', en: 'Idempotency key reused with a different request', ar: 'مفتاح التكرار مستخدم لطلب آخر' },
  IDEMPOTENCY_IN_PROGRESS: { fr: 'Requête identique en cours de traitement', en: 'Identical request in progress', ar: 'طلب مماثل قيد المعالجة' },
  BALANCE_DUE: { fr: 'Solde non réglé', en: 'Balance not settled', ar: 'الرصيد غير مسدَّد' },
  INVOICE_LOCKED: { fr: 'Séjour déjà facturé', en: 'Stay already invoiced', ar: 'تمت فوترة الإقامة' },
  RATE_LIMITED: { fr: 'Trop de requêtes', en: 'Too many requests', ar: 'طلبات كثيرة جدًا' },
  INTERNAL: { fr: 'Erreur interne', en: 'Internal error', ar: 'خطأ داخلي' },
};

export const errorTitle = (code: ErrorCode, lang: Lang) => T[code][lang];
