import { Pressable, StyleSheet, View } from 'react-native';
import type { Room } from '../api/types';
import { useI18n } from '../i18n';
import { type Palette, radius, useTheme } from '../theme';
import { ROOM_TONE } from './Badge';
import { Text } from './Text';

const FILL: Record<string, { bg: keyof Palette; fg: keyof Palette; border: keyof Palette }> = {
  success: { bg: 'successSoft', fg: 'successText', border: 'success500' },
  info: { bg: 'infoSoft', fg: 'infoText', border: 'info500' },
  warning: { bg: 'warningSoft', fg: 'warningText', border: 'warning500' },
  error: { bg: 'errorSoft', fg: 'errorText', border: 'error500' },
};

interface Props {
  room: Room;
  typeCode?: string;
  departingToday?: boolean;
  onPress?: () => void;
}

/**
 * Tuile du tableau des chambres : numéro, type, état par la teinte de la charte ; un point or
 * signale un départ du jour. Le lecteur d'écran annonce tout en mots.
 */
export function RoomTile({ room, typeCode, departingToday, onPress }: Props) {
  const { c } = useTheme();
  const { t } = useI18n();
  const f = FILL[ROOM_TONE[room.status]];
  const label = `${t.room} ${room.number}, ${typeCode ?? ''}, ${t.statuses[room.status]}${departingToday ? `, ${t.departingToday}` : ''}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={onPress ? `${label}. ${t.changeStatus}` : label}
      style={({ pressed }) => [styles.tile, { backgroundColor: c[f.bg], borderColor: c[f.border] }, pressed && { opacity: 0.8 }]}
    >
      <Text variant="title2" color={f.fg}>{room.number}</Text>
      <Text variant="caption" color={f.fg}>{typeCode ?? ''}</Text>
      {departingToday && <View style={[styles.dot, { backgroundColor: c.accent, borderColor: c.surface }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 72, minHeight: 60, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, justifyContent: 'center' },
  dot: { position: 'absolute', top: -5, end: -5, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
