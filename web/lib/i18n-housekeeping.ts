import type { Lang } from './i18n';

const fr = {
  title: 'Ménage',
  allFloors: 'Tous les étages',
  floor: (n: number) => `Étage ${n}`,
  floorFilter: 'Étage',
  room: (n: string) => `Chambre ${n}`,
  updatedAt: 'Mis à jour à',
  loadError: 'Les chambres n’ont pas pu être chargées.',
  retry: 'Réessayer',

  toClean: 'À nettoyer',
  departing: 'Départs du jour',
  outOfOrder: 'Hors service',
  ready: 'Prêtes',
  occupied: 'Occupées',

  priorityTitle: 'À préparer en priorité',
  priorityLine: (n: number, code: string) => (n > 1 ? `${n} chambres ${code} pour les arrivées du jour` : `1 chambre ${code} pour une arrivée du jour`),
  priority: 'Prioritaire',

  nothingToClean: 'Aucune chambre à nettoyer. Beau travail !',
  departingHelp: 'Le client part aujourd’hui : la chambre passera « À nettoyer » après son départ.',
  noDepartures: 'Aucun départ restant aujourd’hui.',
  noOutOfOrder: 'Aucune chambre hors service.',
  noReady: 'Aucune chambre prête.',
  showReady: (n: number) => `Afficher les chambres prêtes (${n})`,
  hideReady: 'Masquer les chambres prêtes',

  markClean: 'Propre',
  backInService: 'Remettre en service',
  needsCleaning: 'À nettoyer',
  reportIssue: 'Signaler un problème',

  done: {
    available: (n: string) => `Chambre ${n} prête.`,
    cleaning: (n: string) => `Chambre ${n} à nettoyer.`,
    maintenance: (n: string) => `Chambre ${n} hors service.`,
    occupied: (n: string) => `Chambre ${n} occupée.`,
  },
  undo: 'Annuler',
  conflict: 'Cette chambre vient d’être modifiée par quelqu’un d’autre. La liste a été actualisée.',
};
export type HousekeepingDict = typeof fr;

const en: HousekeepingDict = {
  title: 'Housekeeping',
  allFloors: 'All floors',
  floor: (n) => `Floor ${n}`,
  floorFilter: 'Floor',
  room: (n) => `Room ${n}`,
  updatedAt: 'Updated at',
  loadError: 'Rooms could not be loaded.',
  retry: 'Try again',

  toClean: 'To clean',
  departing: 'Departing today',
  outOfOrder: 'Out of order',
  ready: 'Ready',
  occupied: 'Occupied',

  priorityTitle: 'Prepare first',
  priorityLine: (n, code) => (n > 1 ? `${n} ${code} rooms for today’s arrivals` : `1 ${code} room for a guest arriving today`),
  priority: 'Priority',

  nothingToClean: 'No rooms to clean. Well done!',
  departingHelp: 'The guest leaves today: the room will move to “To clean” after check-out.',
  noDepartures: 'No departures left today.',
  noOutOfOrder: 'No rooms out of order.',
  noReady: 'No rooms ready.',
  showReady: (n) => `Show ready rooms (${n})`,
  hideReady: 'Hide ready rooms',

  markClean: 'Clean',
  backInService: 'Back in service',
  needsCleaning: 'Needs cleaning',
  reportIssue: 'Report a problem',

  done: {
    available: (n) => `Room ${n} is ready.`,
    cleaning: (n) => `Room ${n} needs cleaning.`,
    maintenance: (n) => `Room ${n} is out of order.`,
    occupied: (n) => `Room ${n} is occupied.`,
  },
  undo: 'Undo',
  conflict: 'Someone else has just changed this room. The list has been refreshed.',
};

const ar: HousekeepingDict = {
  title: 'التدبير المنزلي',
  allFloors: 'كل الطوابق',
  floor: (n) => `الطابق ${n}`,
  floorFilter: 'الطابق',
  room: (n) => `الغرفة ${n}`,
  updatedAt: 'آخر تحديث',
  loadError: 'تعذّر تحميل الغرف.',
  retry: 'إعادة المحاولة',

  toClean: 'بحاجة إلى تنظيف',
  departing: 'مغادرة اليوم',
  outOfOrder: 'خارج الخدمة',
  ready: 'جاهزة',
  occupied: 'مشغولة',

  priorityTitle: 'للتحضير أولًا',
  priorityLine: (n, code) => (n === 1 ? `غرفة ${code} واحدة لوصول اليوم` : `غرف ${code}: ${n} لوصول اليوم`),
  priority: 'أولوية',

  nothingToClean: 'لا توجد غرف بحاجة إلى تنظيف. أحسنت!',
  departingHelp: 'يغادر النزيل اليوم: ستنتقل الغرفة إلى «بحاجة إلى تنظيف» بعد المغادرة.',
  noDepartures: 'لا مغادرة متبقية اليوم.',
  noOutOfOrder: 'لا توجد غرف خارج الخدمة.',
  noReady: 'لا توجد غرف جاهزة.',
  showReady: (n) => `عرض الغرف الجاهزة (${n})`,
  hideReady: 'إخفاء الغرف الجاهزة',

  markClean: 'نظيفة',
  backInService: 'إعادة إلى الخدمة',
  needsCleaning: 'بحاجة إلى تنظيف',
  reportIssue: 'الإبلاغ عن مشكلة',

  done: {
    available: (n) => `الغرفة ${n} جاهزة.`,
    cleaning: (n) => `الغرفة ${n} بحاجة إلى تنظيف.`,
    maintenance: (n) => `الغرفة ${n} خارج الخدمة.`,
    occupied: (n) => `الغرفة ${n} مشغولة.`,
  },
  undo: 'تراجع',
  conflict: 'عدّل شخص آخر هذه الغرفة للتو. تم تحديث القائمة.',
};

export const HOUSEKEEPING: Record<Lang, HousekeepingDict> = { fr, en, ar };
