import { deviceLanguage } from './device';

/** Textes de l'application elle-même ; ensuite, l'application web suit la langue du profil. */
const fr = {
  title: 'Serveur de l’hôtel',
  intro: 'Saisissez l’adresse de l’application de gestion de votre hôtel. Elle vous est fournie par la direction ou le service informatique.',
  label: 'Adresse du serveur',
  hint: 'Exemple : https://pms.mon-hotel.com ou 192.168.1.10:3001',
  connect: 'Se connecter',
  connecting: 'Vérification…',
  cancel: 'Annuler',
  invalid: 'Cette adresse n’est pas valide.',
  unreachable: 'Serveur injoignable. Vérifiez l’adresse et la connexion (Wi-Fi ou données mobiles), puis réessayez.',
  notPms: 'Ce serveur répond, mais ce n’est pas l’application de gestion de l’hôtel.',
  offlineTitle: 'Pas de connexion',
  offlineText: 'Le serveur de l’hôtel ne répond pas. Vérifiez le Wi-Fi ou les données mobiles.',
  retry: 'Réessayer',
  changeServer: 'Changer de serveur',
};

type Texts = typeof fr;

const en: Texts = {
  title: 'Hotel server',
  intro: 'Enter the address of your hotel’s management application. Your manager or IT department can give it to you.',
  label: 'Server address',
  hint: 'Example: https://pms.my-hotel.com or 192.168.1.10:3001',
  connect: 'Connect',
  connecting: 'Checking…',
  cancel: 'Cancel',
  invalid: 'This address is not valid.',
  unreachable: 'Server unreachable. Check the address and your connection (Wi-Fi or mobile data), then try again.',
  notPms: 'This server answers, but it is not the hotel management application.',
  offlineTitle: 'No connection',
  offlineText: 'The hotel server is not responding. Check Wi-Fi or mobile data.',
  retry: 'Retry',
  changeServer: 'Change server',
};

const ar: Texts = {
  title: 'خادم الفندق',
  intro: 'أدخل عنوان تطبيق إدارة فندقك. تزوّدك به الإدارة أو قسم المعلوماتية.',
  label: 'عنوان الخادم',
  hint: 'مثال: https://pms.my-hotel.com أو 192.168.1.10:3001',
  connect: 'اتصال',
  connecting: 'جارٍ التحقق…',
  cancel: 'إلغاء',
  invalid: 'هذا العنوان غير صالح.',
  unreachable: 'تعذّر الوصول إلى الخادم. تحقق من العنوان ومن الاتصال (Wi-Fi أو بيانات الجوال) ثم أعد المحاولة.',
  notPms: 'هذا الخادم يستجيب، لكنه ليس تطبيق إدارة الفندق.',
  offlineTitle: 'لا يوجد اتصال',
  offlineText: 'خادم الفندق لا يستجيب. تحقق من شبكة Wi-Fi أو بيانات الجوال.',
  retry: 'إعادة المحاولة',
  changeServer: 'تغيير الخادم',
};

const code = deviceLanguage() ?? 'fr';
export const LANG = code === 'ar' ? 'ar' : code === 'en' ? 'en' : 'fr';

export const T: Texts = { fr, en, ar }[LANG];
