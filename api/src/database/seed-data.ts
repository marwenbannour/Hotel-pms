import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Role } from '../common/permissions';
import { NavigationItem, Room, RoomType, User } from './entities';

/** Menu par défaut : les entrées V2 (module restaurant) n'apparaissent que si le module est activé. */
export const DEFAULT_NAVIGATION: Partial<NavigationItem>[] = [
  { key: 'dashboard', path: '/', icon: 'home', permission: null, labelFr: 'Tableau de bord', labelEn: 'Dashboard', labelAr: 'لوحة القيادة', sortOrder: 0 },
  { key: 'frontdesk', path: null, icon: 'concierge', permission: null, labelFr: 'Réception', labelEn: 'Front desk', labelAr: 'الاستقبال', sortOrder: 10 },
  { key: 'frontdesk.arrivals', parentKey: 'frontdesk', path: '/frontdesk/arrivals', icon: 'log-in', permission: 'frontdesk:operate', labelFr: 'Arrivées du jour', labelEn: 'Today’s arrivals', labelAr: 'وصول اليوم', sortOrder: 11 },
  { key: 'frontdesk.departures', parentKey: 'frontdesk', path: '/frontdesk/departures', icon: 'log-out', permission: 'frontdesk:operate', labelFr: 'Départs du jour', labelEn: 'Today’s departures', labelAr: 'مغادرة اليوم', sortOrder: 12 },
  { key: 'reservations', path: '/reservations', icon: 'calendar', permission: 'reservations:read', labelFr: 'Réservations', labelEn: 'Reservations', labelAr: 'الحجوزات', sortOrder: 20 },
  { key: 'planning', path: '/planning', icon: 'grid', permission: 'availability:read', labelFr: 'Planning des chambres', labelEn: 'Room planner', labelAr: 'مخطط الغرف', sortOrder: 25 },
  { key: 'guests', path: '/guests', icon: 'users', permission: 'guests:read', labelFr: 'Clients', labelEn: 'Guests', labelAr: 'النزلاء', sortOrder: 30 },
  { key: 'housekeeping', path: '/housekeeping', icon: 'sparkles', permission: 'rooms:status', labelFr: 'Ménage', labelEn: 'Housekeeping', labelAr: 'التدبير المنزلي', sortOrder: 40 },
  { key: 'restaurant', path: '/restaurant', icon: 'utensils', permission: null, module: 'restaurant', labelFr: 'Restaurant', labelEn: 'Restaurant', labelAr: 'المطعم', sortOrder: 50 },
  { key: 'invoices', path: '/invoices', icon: 'receipt', permission: 'billing:read', labelFr: 'Factures', labelEn: 'Invoices', labelAr: 'الفواتير', sortOrder: 55 },
  { key: 'reports', path: '/reports', icon: 'chart', permission: 'reports:read', labelFr: 'Rapports', labelEn: 'Reports', labelAr: 'التقارير', sortOrder: 60 },
  { key: 'admin', path: null, icon: 'settings', permission: null, labelFr: 'Administration', labelEn: 'Administration', labelAr: 'الإدارة', sortOrder: 90 },
  { key: 'admin.rooms', parentKey: 'admin', path: '/admin/rooms', icon: 'bed', permission: 'rooms:write', labelFr: 'Chambres', labelEn: 'Rooms', labelAr: 'الغرف', sortOrder: 91 },
  { key: 'admin.menu', parentKey: 'admin', path: '/admin/menu', icon: 'menu', permission: 'admin:navigation', labelFr: 'Menu', labelEn: 'Menu', labelAr: 'القائمة', sortOrder: 92 },
];

export const DEMO_PASSWORD = 'ChangeMe!2026';
export const DEMO_USERS: { email: string; fullName: string; role: Role; locale?: 'fr' | 'en' | 'ar' }[] = [
  { email: 'admin@hotel.local', fullName: 'Direction', role: 'admin' },
  { email: 'reception@hotel.local', fullName: 'Réception', role: 'reception' },
  { email: 'menage@hotel.local', fullName: 'Ménage', role: 'housekeeping', locale: 'ar' },
  { email: 'restaurant@hotel.local', fullName: 'Restaurant', role: 'restaurant' },
  { email: 'compta@hotel.local', fullName: 'Comptabilité', role: 'accounting' },
  { email: 'it@hotel.local', fullName: 'Informatique', role: 'it' },
];

export async function seed(ds: DataSource, opts: { users?: boolean; rooms?: boolean } = { users: true, rooms: true }) {
  await ds.transaction(async (m) => {
    // Parents d'abord (contrainte parent_key).
    const ordered = [...DEFAULT_NAVIGATION].sort((a, b) => Number(!!a.parentKey) - Number(!!b.parentKey));
    for (const item of ordered) {
      await m.createQueryBuilder().insert().into(NavigationItem).values(item).orIgnore().execute();
    }
    if (opts.users) {
      const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
      for (const u of DEMO_USERS) {
        await m.createQueryBuilder().insert().into(User).values({ ...u, locale: u.locale ?? 'fr', passwordHash: hash }).orIgnore().execute();
      }
    }
    if (opts.rooms) {
      const types = [
        { code: 'SGL', name: 'Chambre simple', capacity: 1, basePrice: 7500, currency: 'EUR' },
        { code: 'DBL', name: 'Chambre double', capacity: 2, basePrice: 9500, currency: 'EUR' },
        { code: 'FAM', name: 'Chambre familiale', capacity: 4, basePrice: 15000, currency: 'EUR' },
      ];
      for (const t of types) await m.createQueryBuilder().insert().into(RoomType).values(t).orIgnore().execute();
      const byCode = Object.fromEntries((await m.find(RoomType)).map((t) => [t.code, t.id]));
      const rooms = [
        ...['101', '102', '103'].map((n) => ({ number: n, floor: 1, roomTypeId: byCode.SGL })),
        ...['201', '202', '203', '204'].map((n) => ({ number: n, floor: 2, roomTypeId: byCode.DBL })),
        ...['301', '302'].map((n) => ({ number: n, floor: 3, roomTypeId: byCode.FAM })),
      ];
      for (const r of rooms) await m.createQueryBuilder().insert().into(Room).values(r).orIgnore().execute();
    }
  });
}

/**
 * Journée type pour la démonstration du tableau de bord : clients présents, arrivées et
 * départs du jour, chambres à nettoyer, une chambre en maintenance, un départ en retard
 * et des réservations sur les 15 prochains jours. À n'utiliser que sur une base de démonstration.
 */
export async function seedDemoDay(ds: DataSource, today: string) {
  const day = (n: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  await ds.transaction(async (m) => {
    const types = Object.fromEntries((await m.query(`SELECT id, code, base_price FROM room_types`)).map((t: { code: string }) => [t.code, t]));
    const rooms = Object.fromEntries((await m.query(`SELECT id, number FROM rooms`)).map((r: { number: string; id: string }) => [r.number, r.id]));
    const guests = [
      ['Amina', 'Benali'], ['Lucas', 'Moreau'], ['Sofia', 'Rossi'], ['Karim', 'Haddad'], ['Emma', 'Laurent'],
      ['Youssef', 'El Idrissi'], ['Claire', 'Dubois'], ['Hugo', 'Petit'], ['Nadia', 'Cherif'], ['Tom', 'Walker'],
      ['Inès', 'Garcia'], ['Mehdi', 'Kacem'],
    ];
    const guestIds: string[] = [];
    for (const [first, last] of guests) {
      const [{ id }] = await m.query(`INSERT INTO guests (first_name, last_name) VALUES ($1, $2) RETURNING id`, [first, last]);
      guestIds.push(id);
    }
    let n = 0;
    const add = async (o: {
      type: string; from: number; to: number; status: string; room?: string; adults?: number; board?: string; notes?: string;
    }) => {
      const t = types[o.type];
      const nights = o.to - o.from;
      const adults = o.adults ?? (o.type === 'SGL' ? 1 : 2);
      const board = o.board ?? 'room_only';
      const sup = board === 'half_board' ? 2500 : board === 'full_board' ? 4500 : 0;
      await m.query(
        `INSERT INTO reservations (reference, guest_id, room_type_id, room_id, arrival_date, departure_date, adults, board, channel,
           status, total_amount, currency, notes, checked_in_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'EUR',$12, CASE WHEN $10 IN ('checked_in','checked_out') THEN now() END)`,
        [
          `RDEMO${String(++n).padStart(3, '0')}`, guestIds[(n - 1) % guestIds.length], t.id, o.room ? rooms[o.room] : null,
          day(o.from), day(o.to), adults, board, ['direct', 'ota', 'phone', 'web'][n % 4], o.status,
          nights * (t.base_price + sup * adults), o.notes ?? null,
        ],
      );
    };
    // Clients présents
    await add({ type: 'DBL', from: -2, to: 0, status: 'checked_in', room: '201', board: 'half_board' }); // départ aujourd'hui
    await add({ type: 'SGL', from: -1, to: 0, status: 'checked_in', room: '101' }); // départ aujourd'hui
    await add({ type: 'FAM', from: -3, to: 2, status: 'checked_in', room: '301', adults: 3, board: 'full_board' });
    await add({ type: 'DBL', from: -1, to: 3, status: 'checked_in', room: '202', board: 'half_board' });
    await add({ type: 'DBL', from: -4, to: -1, status: 'checked_in', room: '204' }); // départ en retard
    // Départ déjà effectué ce matin
    await add({ type: 'SGL', from: -2, to: 0, status: 'checked_out', room: '102' });
    // Arrivées du jour
    await add({ type: 'DBL', from: 0, to: 2, status: 'confirmed', board: 'half_board', notes: 'Arrivée tardive vers 22 h' });
    await add({ type: 'DBL', from: 0, to: 4, status: 'confirmed' });
    await add({ type: 'SGL', from: 0, to: 1, status: 'confirmed' });
    await add({ type: 'FAM', from: 0, to: 3, status: 'confirmed', adults: 4, board: 'half_board', notes: 'Lit bébé demandé' });
    // Prévisions
    await add({ type: 'DBL', from: 2, to: 6, status: 'confirmed' });
    await add({ type: 'SGL', from: 3, to: 5, status: 'confirmed' });
    await add({ type: 'FAM', from: 4, to: 7, status: 'confirmed', adults: 3 });
    await add({ type: 'DBL', from: 5, to: 7, status: 'confirmed', board: 'full_board' });
    // Historique de la semaine passée
    await add({ type: 'DBL', from: -7, to: -3, status: 'checked_out', room: '203' });
    await add({ type: 'SGL', from: -6, to: -2, status: 'checked_out', room: '103' });
    await add({ type: 'FAM', from: -7, to: -4, status: 'checked_out', room: '302' });

    const setStatus = (numbers: string[], status: string) =>
      m.query(`UPDATE rooms SET status = $1, version = version + 1 WHERE number = ANY($2)`, [status, numbers]);
    await setStatus(['201', '101', '301', '202', '204'], 'occupied');
    await setStatus(['102'], 'cleaning');
    await setStatus(['302'], 'maintenance');
    // Émetteur fictif pour que les factures de démonstration soient complètes.
    const [{ value }] = await m.query(`SELECT value FROM settings WHERE key = 'billing'`);
    value.country = 'FR';
    value.seller = {
      legalName: 'Hôtel de Démonstration SARL',
      address: '12 rue de la Gare\n75010 Paris',
      taxId: 'FR00123456789',
      registration: 'RCS Paris 123 456 789',
      footer: 'Taxe de séjour collectée pour le compte de la commune. Pénalités de retard : 3 fois le taux d’intérêt légal.',
    };
    await m.query(`UPDATE settings SET value = $1, version = version + 1 WHERE key = 'billing'`, [JSON.stringify(value)]);
    // Pré-attributions pour le planning : deux séjours à venir ont déjà leur chambre.
    await m.query(`UPDATE reservations SET room_id = $1 WHERE reference = 'RDEMO011'`, [rooms['203']]);
    await m.query(`UPDATE reservations SET room_id = $1 WHERE reference = 'RDEMO014'`, [rooms['201']]);
  });
}
