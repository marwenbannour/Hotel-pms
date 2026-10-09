import {
  BedDouble, CalendarDays, ChartColumn, ConciergeBell, House, LayoutGrid, LogIn, LogOut, Menu, ReceiptText, Settings,
  Sparkles, User, UserCog, Users, Utensils, type LucideIcon,
} from 'lucide-react-native';
import { type Palette, useTheme } from '../theme';

/** Icônes du menu, telles que l'API les nomme (navigation_items.icon). */
export const MENU_ICONS: Record<string, LucideIcon> = {
  home: House, concierge: ConciergeBell, calendar: CalendarDays, grid: LayoutGrid, users: Users, sparkles: Sparkles,
  utensils: Utensils, chart: ChartColumn, receipt: ReceiptText, settings: Settings, bed: BedDouble, menu: Menu,
  'user-cog': UserCog, 'log-in': LogIn, 'log-out': LogOut, user: User,
};

/** Icône Lucide (style ligne, trait de 2px) dans une couleur du thème. */
export function Icon({ icon: Glyph, size = 20, color = 'text' }: { icon: LucideIcon; size?: number; color?: keyof Palette }) {
  const { c } = useTheme();
  return <Glyph size={size} color={c[color]} strokeWidth={2} />;
}
