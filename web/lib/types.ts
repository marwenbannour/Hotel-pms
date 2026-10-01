export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance';

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: string;
  locale: 'fr' | 'en' | 'ar';
  permissions: string[];
  mfaEnabled: boolean;
  mfaRequired: boolean;
  hotel: { name: string; timezone: string; currency: string; today: string };
}

export interface MenuEntry {
  key: string;
  label: string;
  path: string | null;
  icon: string | null;
  children: MenuEntry[];
}

export interface Room {
  id: string;
  number: string;
  floor: number | null;
  roomTypeId: string;
  status: RoomStatus;
  version: number;
}

export interface RoomType {
  id: string;
  code: string;
  name: string;
}

export interface Movement {
  id: string;
  reference: string;
  status: 'confirmed' | 'checked_in' | 'checked_out';
  guestName: string;
  roomType: string;
  roomNumber: string | null;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  board: 'room_only' | 'half_board' | 'full_board';
  notes: string | null;
}

export interface DashboardAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  count: number;
}

export interface KpiTotals {
  roomsAvailable: number;
  roomsSold: number;
  occupancyRate: number;
  revenue?: number;
  adr?: number;
  revpar?: number;
  averageLengthOfStay?: number;
}

export interface Dashboard {
  date: string;
  generatedAt: string;
  sections: ('rooms' | 'movements' | 'alerts' | 'kpis')[];
  rooms?: Record<RoomStatus, number> & {
    total: number;
    departingToday: string[];
    byType?: (Record<RoomStatus, number> & { code: string; name: string; arrivalsPending: number })[];
  };
  movements?: {
    arrivals: Movement[];
    departures: Movement[];
    arrivalsPending: number;
    departuresPending: number;
    inHouse: number;
  };
  alerts?: DashboardAlert[];
  kpis?: {
    currency?: string;
    today: KpiTotals;
    monthToDate?: KpiTotals;
    trend?: { date: string; occupancyRate: number; revenue: number; forecast: boolean }[];
  };
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export type ReservationStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type Board = 'room_only' | 'half_board' | 'full_board';
export type Channel = 'direct' | 'phone' | 'web' | 'agency' | 'ota';

export interface Reservation {
  id: string;
  reference: string;
  status: ReservationStatus;
  guest: { id: string; firstName?: string; lastName?: string };
  roomType: { id: string; code?: string; name?: string };
  room: { id: string; number: string } | null;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  children: number;
  board: Board;
  channel: Channel;
  totalAmount: number;
  currency: string;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  version: number;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  segment: string;
  preferences?: Record<string, unknown>;
  erased?: boolean;
  createdAt?: string;
  version?: number;
}

export interface GuestStay {
  id: string;
  reference: string;
  status: ReservationStatus;
  arrivalDate: string;
  departureDate: string;
  totalAmount: number;
  currency: string;
}

export interface AvailabilityType {
  roomTypeId: string;
  code: string;
  name: string;
  capacity: number;
  nightlyRate: number;
  currency: string;
  available: number;
}

export interface Quote {
  nights: number;
  nightlyRate: number;
  boardSupplementPerPerson: number;
  totalAmount: number;
  currency: string;
  capacity: number;
  fitsCapacity: boolean;
  available: number;
  unavailableNights: string[];
}

export interface HistoryEntry {
  action: string;
  at: string;
  actor: { id: string; name: string | null } | null;
  data: Record<string, unknown>;
}

export interface PlanningStay {
  id: string;
  reference: string;
  guestName: string;
  roomId: string | null;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  status: 'confirmed' | 'checked_in' | 'checked_out';
  adults: number;
  children: number;
  version: number;
  overdue: boolean;
}

export interface PlanningData {
  from: string;
  to: string;
  today: string;
  roomTypes: { id: string; code: string; name: string; capacity: number }[];
  rooms: { id: string; number: string; floor: number | null; roomTypeId: string; roomTypeCode: string; status: RoomStatus }[];
  stays: PlanningStay[];
}

export interface FolioLine {
  kind: 'stay' | 'tourist_tax' | 'charge';
  chargeId?: string;
  category?: string;
  postedOn?: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  vatRate: number;
  vatAmount: number;
  htAmount: number;
}

export interface Totals {
  ttc: number;
  ht: number;
  vat: number;
  breakdown: { rate: number; base: number; vat: number }[];
}

export interface Folio {
  reservationId: string;
  currency: string;
  locked: boolean;
  invoice: { id: string; number: string; issuedAt: string } | null;
  lines: FolioLine[];
  totals: Totals;
  payments: { id: string; kind: string; method: string; amount: number; pspReference: string | null; reference: string | null; receivedAt: string }[];
  paid: number;
  balance: number;
  documents: { id: string; number: string; kind: 'invoice' | 'credit_note'; issuedAt: string; totalTtc: number }[];
}

export interface Invoice {
  id: string;
  number: string;
  kind: 'invoice' | 'credit_note';
  reservationId: string;
  issuedAt: string;
  issueDate: string;
  lang: 'fr' | 'en' | 'ar';
  currency: string;
  customer: { name: string; email?: string | null; phone?: string | null; country?: string | null; reservation?: string };
  seller: { legalName: string; address?: string; taxId?: string; registration?: string; footer?: string; country?: string | null };
  totals: Totals;
  reason: string | null;
  hash: string;
  lines?: (Omit<FolioLine, 'chargeId' | 'category' | 'postedOn'> & { position: number })[];
  creditNote?: { id: string; number: string } | null;
  creditedInvoiceNumber?: string | null;
}
