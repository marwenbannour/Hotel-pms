import { Brush, Check, Wrench } from 'lucide-react-native';
import { TRANSITIONS } from '../api/hotel';
import type { Room, RoomStatus } from '../api/types';
import { useI18n } from '../i18n';
import { Badge, BottomSheet, ROOM_TONE, type SheetAction } from '../ui';

const ICON = { available: Check, cleaning: Brush, maintenance: Wrench, occupied: Check } as const;

/** Feuille d'actions d'une chambre : les transitions d'état autorisées depuis son état actuel. */
export function RoomSheet({
  room, typeCode, onPick, onClose,
}: { room: Room | null; typeCode?: string; onPick: (room: Room, status: RoomStatus) => void; onClose: () => void }) {
  const { t, h, m } = useI18n();
  const actions: SheetAction[] = room
    ? TRANSITIONS[room.status].map((s) => ({
        icon: ICON[s],
        label: s === 'available' ? h.markClean : s === 'cleaning' ? h.needsCleaning : h.reportIssue,
        tone: s === 'maintenance' ? 'errorText' : 'text',
        onPress: () => onPick(room, s),
      }))
    : [];
  return (
    <BottomSheet
      visible={!!room}
      title={room ? `${h.room(room.number)}${typeCode ? ` · ${typeCode}` : ''}` : ''}
      aside={room ? <Badge label={t.statuses[room.status]} tone={ROOM_TONE[room.status]} /> : undefined}
      actions={actions}
      closeLabel={m.close}
      onClose={onClose}
    />
  );
}
