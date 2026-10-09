import { LogIn, LogOut } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { isActionable } from '../api/hotel';
import type { Movement } from '../api/types';
import { useI18n } from '../i18n';
import { space } from '../theme';
import { Badge, Button, Card, ErrorNote, RESERVATION_TONE, Text } from '../ui';

interface Props {
  kind: 'arrivals' | 'departures';
  movement: Movement;
  canOperate: boolean;
  busy: boolean;
  error?: string;
  onAction: () => void;
  onOpen: () => void;
  onOpenBilling: () => void;
}

/** Arrivée ou départ du jour : client, détails, action au pouce sur toute la largeur. */
export function MovementCard({ kind, movement: m, canOperate, busy, error, onAction, onOpen, onOpenBilling }: Props) {
  const { t, r, b } = useI18n();
  const actionable = isActionable(kind, m);
  return (
    <Card onPress={onOpen} accessibilityLabel={`${m.guestName}, ${m.reference}`}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="title2" numberOfLines={1}>{m.guestName}</Text>
          <Text variant="caption" color="textMuted">{m.reference} · {t.boards[m.board]}</Text>
        </View>
        <Badge label={r.statuses[m.status]} tone={RESERVATION_TONE[m.status]} />
      </View>
      <Text color="textMuted" style={styles.line}>
        {m.roomType} · {t.room} {m.roomNumber ?? '–'} · {t.guests} {m.adults + m.children}
      </Text>
      {m.notes ? <Text variant="caption" style={styles.line}>{m.notes}</Text> : null}
      {error ? <View style={styles.line}><ErrorNote message={error} action={{ label: b.billing, onPress: onOpenBilling }} /></View> : null}
      {canOperate && actionable && (
        <Button
          label={kind === 'arrivals' ? t.checkIn : t.checkOut}
          icon={kind === 'arrivals' ? LogIn : LogOut}
          onPress={onAction}
          loading={busy}
          fullWidth
          style={styles.action}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  line: { marginTop: space[2] },
  action: { marginTop: space[3] },
});
