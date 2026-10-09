import { Check, LogOut, Sparkles, Wrench } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { roomErrorMessage, TRANSITIONS, useDashboard, useRooms, useRoomStatus, useTypeCodes } from '../api/hotel';
import { useCan } from '../api/queries';
import type { Room, RoomStatus } from '../api/types';
import { useI18n } from '../i18n';
import { radius, space, useTheme } from '../theme';
import { Badge, Button, Card, ErrorNote, FilterChips, Icon, LoadError, Loading, ROOM_TONE, Screen, SectionTitle, Text, Toast } from '../ui';

const UNDO_MS = 8_000;
const byFloorAndNumber = (a: Room, b: Room) => (a.floor ?? 0) - (b.floor ?? 0) || a.number.localeCompare(b.number, undefined, { numeric: true });

interface LastChange {
  room: Room;
  from: RoomStatus;
}

/**
 * Ménage : chambres à nettoyer d'abord (les prioritaires en tête), départs du jour, hors
 * service, prêtes. Chaque action peut être annulée pendant 8 secondes. Même logique que le web.
 */
export function HousekeepingScreen() {
  const { c } = useTheme();
  const { h, t, m, f } = useI18n();
  const can = useCan();
  const canChange = can('rooms:status');
  const dashboard = useDashboard();
  const rooms = useRooms();
  const typeCode = useTypeCodes();
  const [floor, setFloor] = useState<number | null>(null);
  const [showReady, setShowReady] = useState(false);
  const [last, setLast] = useState<LastChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const change = useRoomStatus((room, from, undo) => {
    setError(null);
    setLast(undo ? null : { room, from });
  });

  useEffect(() => {
    if (!last) return;
    const id = setTimeout(() => setLast(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [last]);

  if (dashboard.isError || rooms.isError) return <LoadError message={h.loadError} onRetry={() => { dashboard.refetch(); rooms.refetch(); }} />;
  if (!dashboard.data || !rooms.data) return <Loading />;

  const departing = new Set(dashboard.data.rooms?.departingToday ?? []);
  const all = [...rooms.data].sort(byFloorAndNumber);
  const floors = [...new Set(all.map((r) => r.floor ?? 0))].sort((a, b) => a - b);

  // Chambres à préparer en priorité : arrivées du jour sans chambre prête de leur type.
  const needs = (dashboard.data.rooms?.byType ?? []).map((bt) => ({ code: bt.code, need: bt.arrivalsPending - bt.available })).filter((n) => n.need > 0);
  const priority = new Set<string>();
  for (const { code, need } of needs) {
    all.filter((r) => r.status === 'cleaning' && typeCode.get(r.roomTypeId) === code).slice(0, need).forEach((r) => priority.add(r.id));
  }

  const visible = all.filter((r) => floor === null || (r.floor ?? 0) === floor);
  const toClean = visible.filter((r) => r.status === 'cleaning').sort((a, b) => Number(priority.has(b.id)) - Number(priority.has(a.id)));
  const leaving = visible.filter((r) => r.status === 'occupied' && departing.has(r.number));
  const outOfOrder = visible.filter((r) => r.status === 'maintenance');
  const ready = visible.filter((r) => r.status === 'available');

  const busy = change.isPending;
  const act = (room: Room, status: RoomStatus, undo = false) =>
    change.mutate({ room, status, undo }, { onError: (e) => { setLast(null); setError(roomErrorMessage(e, h.conflict)); } });
  const canUndo = last && TRANSITIONS[last.room.status].includes(last.from);

  const card = (room: Room, actions: React.ReactNode) => (
    <Card key={room.id}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text variant="title2">{h.room(room.number)}</Text>
          <Text variant="caption" color="textMuted">
            {typeCode.get(room.roomTypeId)}{room.floor !== null ? ` · ${h.floor(room.floor)}` : ''}
          </Text>
        </View>
        {priority.has(room.id) ? <Badge label={h.priority} tone="accent" /> : <Badge label={t.statuses[room.status]} tone={ROOM_TONE[room.status]} />}
      </View>
      {actions && canChange ? <View style={styles.actions}>{actions}</View> : null}
    </Card>
  );

  const counts: [string, number][] = [
    [h.toClean, toClean.length],
    [h.departing, leaving.length],
    [h.outOfOrder, outOfOrder.length],
    [h.ready, ready.length],
  ];

  return (
    <Screen
      safeTop
      onRefresh={() => { dashboard.refetch(); rooms.refetch(); }}
      refreshing={dashboard.isRefetching || rooms.isRefetching}
      overlay={
        last ? (
          <Toast
            message={h.done[last.room.status](last.room.number)}
            action={canUndo ? { label: h.undo, disabled: busy, onPress: () => act(last.room, last.from, true) } : undefined}
          />
        ) : null
      }
    >
      <View>
        <Text variant="title1" accessibilityRole="header">{h.title}</Text>
        <Text color="textMuted">{f.longDate(dashboard.data.date)}</Text>
      </View>

      <View style={styles.counts}>
        {counts.map(([label, n]) => (
          <View key={label} style={[styles.count, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text variant="display2" color="accentText">{n}</Text>
            <Text variant="caption" color="textMuted">{label}</Text>
          </View>
        ))}
      </View>

      {needs.length > 0 && (
        <View style={[styles.priority, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
          <Text variant="title2">{h.priorityTitle}</Text>
          {needs.map((n) => <Text key={n.code}>• {h.priorityLine(n.need, n.code)}</Text>)}
        </View>
      )}

      {floors.length > 1 && (
        <FilterChips
          label={h.floorFilter}
          value={floor}
          onChange={setFloor}
          options={[{ value: null, label: h.allFloors }, ...floors.map((fl) => ({ value: fl, label: h.floor(fl) }))]}
        />
      )}

      <ErrorNote message={error} />

      <View style={styles.section}>
        <View style={styles.titleRow}><Icon icon={Sparkles} color="warningText" /><SectionTitle title={h.toClean} /></View>
        {toClean.length === 0 ? (
          <Text variant="bodyLg" color="textMuted">{h.nothingToClean}</Text>
        ) : (
          toClean.map((room) =>
            card(
              room,
              <>
                <Button label={h.markClean} icon={Check} onPress={() => act(room, 'available')} disabled={busy} style={styles.flex} />
                <Button label={`${h.reportIssue}, ${h.room(room.number)}`} icon={Wrench} iconOnly variant="outline" onPress={() => act(room, 'maintenance')} disabled={busy} />
              </>,
            ),
          )
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}><Icon icon={LogOut} color="accentText" /><SectionTitle title={h.departing} /></View>
        {leaving.length === 0 ? (
          <Text color="textMuted">{h.noDepartures}</Text>
        ) : (
          <>
            <Text variant="caption" color="textMuted">{h.departingHelp}</Text>
            {leaving.map((room) => card(room, null))}
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}><Icon icon={Wrench} color="errorText" /><SectionTitle title={h.outOfOrder} /></View>
        {outOfOrder.length === 0 ? (
          <Text color="textMuted">{h.noOutOfOrder}</Text>
        ) : (
          outOfOrder.map((room) =>
            card(
              room,
              <>
                <Button label={h.backInService} onPress={() => act(room, 'available')} disabled={busy} style={styles.flex} />
                <Button label={h.needsCleaning} variant="outline" onPress={() => act(room, 'cleaning')} disabled={busy} style={styles.flex} />
              </>,
            ),
          )
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}><Icon icon={Check} color="successText" /><SectionTitle title={h.ready} /></View>
        {ready.length === 0 ? (
          <Text color="textMuted">{h.noReady}</Text>
        ) : (
          <>
            <Button label={showReady ? h.hideReady : h.showReady(ready.length)} variant="outline" onPress={() => setShowReady(!showReady)} />
            {showReady &&
              ready.map((room) =>
                card(
                  room,
                  <>
                    <Button label={h.needsCleaning} variant="outline" onPress={() => act(room, 'cleaning')} disabled={busy} style={styles.flex} />
                    <Button label={h.reportIssue} variant="outline" onPress={() => act(room, 'maintenance')} disabled={busy} style={styles.flex} />
                  </>,
                ),
              )}
          </>
        )}
      </View>
      {/* Place pour le toast d'annulation. */}
      {last ? <View style={{ height: 64 }} /> : null}
      <Text variant="caption" color="textFaint" align="center">
        {m.roomsTitle} · {h.updatedAt} {f.time(new Date(Math.max(dashboard.dataUpdatedAt, rooms.dataUpdatedAt)))}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  count: { flexGrow: 1, flexBasis: '45%', padding: space[3], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  priority: { padding: space[4], borderRadius: radius.lg, borderWidth: 1, gap: space[1] },
  section: { gap: space[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  actions: { flexDirection: 'row', gap: space[2], marginTop: space[3] },
});
