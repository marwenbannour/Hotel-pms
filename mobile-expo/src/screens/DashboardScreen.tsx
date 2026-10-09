import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../api/client';
import { roomErrorMessage, useDashboard, useRooms, useRoomStatus, useStayAction, useTypeCodes } from '../api/hotel';
import { useCan, useMe } from '../api/queries';
import type { Room } from '../api/types';
import { useI18n } from '../i18n';
import type { TabScreenProps } from '../navigation/types';
import { radius, space, useTheme } from '../theme';
import { AlertCard, Card, ErrorNote, LoadError, Loading, RoomTile, Screen, SectionTitle, Text } from '../ui';
import { MovementCard } from './MovementCard';
import { RoomSheet } from './RoomSheet';

/**
 * Tableau de bord (charte HOTELIA, écran 2) : salutation, résumé du jour en chiffres or,
 * alertes, tableau des chambres, arrivées et départs. Les sections suivent le profil.
 */
export function DashboardScreen({ navigation }: TabScreenProps<'Home'>) {
  const { c } = useTheme();
  const { t, m, h, f } = useI18n();
  const me = useMe();
  const can = useCan();
  const dashboard = useDashboard();
  const showRooms = !!dashboard.data?.sections.includes('rooms');
  const rooms = useRooms(showRooms);
  const typeCode = useTypeCodes();
  const [sheetRoom, setSheetRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [stayErrors, setStayErrors] = useState<Record<string, string>>({});
  const status = useRoomStatus(() => setRoomError(null));
  const stay = useStayAction();

  if (dashboard.isError) return <LoadError message={t.loadError} onRetry={() => dashboard.refetch()} />;
  if (!dashboard.data || !me.data) return <Loading />;
  const d = dashboard.data;
  const firstName = me.data.fullName.split(' ')[0];
  const departing = new Set(d.rooms?.departingToday ?? []);
  const floors = new Map<number, Room[]>();
  for (const r of [...(rooms.data ?? [])].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))) {
    floors.set(r.floor ?? 0, [...(floors.get(r.floor ?? 0) ?? []), r]);
  }

  const kpis: [string, string][] = d.movements
    ? [
        [t.arrivalsPending, String(d.movements.arrivalsPending)],
        [t.departuresPending, String(d.movements.departuresPending)],
        [t.inHouse, String(d.movements.inHouse)],
        ...(d.kpis ? [[`${t.occupancy}`, f.percent(d.kpis.today.occupancyRate)] as [string, string]] : []),
      ]
    : d.rooms
      ? [
          [t.statuses.cleaning, String(d.rooms.cleaning)],
          [t.statuses.available, String(d.rooms.available)],
          [t.statuses.occupied, String(d.rooms.occupied)],
          [t.statuses.maintenance, String(d.rooms.maintenance)],
        ]
      : [];

  const runStay = (id: string, action: 'check-in' | 'check-out') => {
    setStayErrors((e) => ({ ...e, [id]: '' }));
    stay.mutate({ id, action }, { onError: (e) => setStayErrors((prev) => ({ ...prev, [id]: errorMessage(e) })) });
  };

  return (
    <Screen safeTop onRefresh={() => { dashboard.refetch(); rooms.refetch(); }} refreshing={dashboard.isRefetching}>
      <View>
        <Text variant="display2" accessibilityRole="header">{m.hello(firstName)}</Text>
        <Text color="textMuted" style={styles.capitalize}>{m.roles[me.data.role] ?? me.data.role} · {f.longDate(d.date)}</Text>
      </View>

      {kpis.length > 0 && (
        <Card>
          <Text variant="label" color="textMuted">{m.todaySummary}</Text>
          <View style={styles.kpis}>
            {kpis.map(([label, value]) => (
              <View key={label} style={[styles.kpi, { backgroundColor: c.bg }]}>
                <Text variant="display2" color="accentText">{value}</Text>
                <Text variant="caption" color="textMuted">{label}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {d.alerts && d.alerts.length > 0 && (
        <View style={styles.list}>
          <SectionTitle title={t.toHandle} />
          {d.alerts.map((a) => <AlertCard key={a.type} severity={a.severity} message={a.message} />)}
        </View>
      )}

      {showRooms && rooms.data && (
        <View style={styles.list}>
          <SectionTitle title={m.roomsTitle} />
          <ErrorNote message={roomError} />
          <Card>
            <View style={styles.board}>
              {[...floors.entries()].sort(([a], [b]) => b - a).map(([floor, list]) => (
                <View key={floor} style={styles.floor}>
                  <Text variant="caption" color="textMuted" style={styles.floorLabel}>{t.floorShort} {floor}</Text>
                  <View style={styles.tiles}>
                    {list.map((room) => (
                      <RoomTile
                        key={room.id}
                        room={room}
                        typeCode={typeCode.get(room.roomTypeId)}
                        departingToday={departing.has(room.number)}
                        onPress={can('rooms:status') ? () => setSheetRoom(room) : undefined}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

      {d.movements &&
        (['arrivals', 'departures'] as const).map((kind) => {
          const rows = d.movements![kind];
          const pending = kind === 'arrivals' ? d.movements!.arrivalsPending : d.movements!.departuresPending;
          return (
            <View key={kind} style={styles.list}>
              <SectionTitle title={`${kind === 'arrivals' ? t.arrivals : t.departures} · ${pending}/${rows.length}`} />
              {rows.length === 0 ? (
                <Text color="textMuted">{kind === 'arrivals' ? t.noArrivals : t.noDepartures}</Text>
              ) : (
                rows.map((mv) => (
                  <MovementCard
                    key={mv.id}
                    kind={kind}
                    movement={mv}
                    canOperate={can('frontdesk:operate')}
                    busy={stay.isPending && stay.variables?.id === mv.id}
                    error={stayErrors[mv.id]}
                    onAction={() => runStay(mv.id, kind === 'arrivals' ? 'check-in' : 'check-out')}
                    onOpen={() => navigation.navigate('Reservation', { id: mv.id })}
                    onOpenBilling={() => navigation.navigate('Web', { path: `/reservations/${mv.id}`, title: mv.guestName })}
                  />
                ))
              )}
            </View>
          );
        })}

      <RoomSheet
        room={sheetRoom}
        typeCode={sheetRoom ? typeCode.get(sheetRoom.roomTypeId) : undefined}
        onClose={() => setSheetRoom(null)}
        onPick={(room, next) => {
          setSheetRoom(null);
          status.mutate({ room, status: next }, { onError: (e) => setRoomError(roomErrorMessage(e, h.conflict)) });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  capitalize: { textTransform: 'none' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginTop: space[3] },
  kpi: { flexGrow: 1, flexBasis: '45%', padding: space[3], borderRadius: radius.md },
  list: { gap: space[3] },
  board: { gap: space[3] },
  floor: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  floorLabel: { width: 32, paddingTop: space[4] },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
