import { useQuery } from '@tanstack/react-query';
import { ExternalLink, LogIn, LogOut } from 'lucide-react-native';
import { useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError, errorMessage } from '../api/client';
import { useStayAction } from '../api/hotel';
import { useCan, useMe } from '../api/queries';
import type { Folio, Reservation } from '../api/types';
import { useI18n } from '../i18n';
import type { RootScreenProps } from '../navigation/types';
import { space } from '../theme';
import { Badge, Button, Card, ErrorNote, InfoRow, LoadError, Loading, RESERVATION_TONE, Screen, Text } from '../ui';

/**
 * Fiche d'une réservation : séjour, chambre, montant, solde ; arrivée ou départ le jour même.
 * Modification, annulation et encaissements : fiche complète (écran web) en attendant la phase 2.
 */
export function ReservationDetailScreen({ route, navigation }: RootScreenProps<'Reservation'>) {
  const { id } = route.params;
  const { r, t, m, b, f } = useI18n();
  const me = useMe();
  const can = useCan();
  const stay = useStayAction();
  const [error, setError] = useState<string | null>(null);

  const res = useQuery({ queryKey: ['reservation', id], queryFn: async () => (await api<Reservation>(`/reservations/${id}`)).data });
  const folio = useQuery({
    queryKey: ['folio', id],
    queryFn: async () => (await api<Folio>(`/reservations/${id}/folio`)).data,
    enabled: can('billing:read'),
  });
  const money = useI18n(res.data?.currency).f;
  const name = res.data ? `${res.data.guest.firstName ?? ''} ${res.data.guest.lastName ?? ''}`.trim() : '';

  // Le nom est déjà le titre de la fiche : l'en-tête porte la référence.
  const reference = res.data?.reference;
  useLayoutEffect(() => {
    if (reference) navigation.setOptions({ title: reference });
  }, [navigation, reference]);

  if (res.isError) {
    return <LoadError message={res.error instanceof ApiError && res.error.status === 404 ? r.noResults : t.loadError} onRetry={() => res.refetch()} />;
  }
  if (!res.data) return <Loading />;
  const d = res.data;
  const today = me.data?.hotel.today;
  const canOperate = can('frontdesk:operate');
  const canArrive = canOperate && d.status === 'confirmed' && d.arrivalDate === today;
  const canLeave = canOperate && d.status === 'checked_in';
  const openWeb = () => navigation.navigate('Web', { path: `/reservations/${d.id}`, title: name });

  const run = (action: 'check-in' | 'check-out') => {
    setError(null);
    stay.mutate({ id: d.id, action }, { onError: (e) => setError(errorMessage(e)) });
  };

  return (
    <Screen onRefresh={() => { res.refetch(); folio.refetch(); }} refreshing={res.isRefetching}>
      <View style={styles.head}>
        <Text variant="title1" accessibilityRole="header">{name}</Text>
        <View style={styles.row}>
          <Badge label={r.statuses[d.status]} tone={RESERVATION_TONE[d.status]} strike={d.status === 'cancelled'} />
          <Text variant="caption" color="textMuted">{d.reference}</Text>
        </View>
      </View>

      <Card padded={false} style={styles.card}>
        <InfoRow label={r.arrival} value={f.shortDate(d.arrivalDate)} />
        <InfoRow label={r.departure} value={f.shortDate(d.departureDate)} />
        <InfoRow label={r.stay} value={r.nightsCount(d.nights)} />
        <InfoRow label={r.room} value={d.room ? `${d.room.number} · ${d.roomType.code ?? ''}` : `${r.notAssigned}`} />
        <InfoRow label={r.board} value={t.boards[d.board]} />
        <InfoRow label={`${r.adults} / ${r.children}`} value={`${d.adults} / ${d.children}`} />
        <InfoRow label={r.total} value={money.amount(d.totalAmount)} last={!folio.data} />
        {folio.data && (
          <InfoRow
            label={m.balance}
            value={<Text variant="button" color={folio.data.balance > 0 ? 'errorText' : 'successText'}>{folio.data.balance > 0 ? money.amount(folio.data.balance) : m.nothingDue}</Text>}
            last
          />
        )}
      </Card>

      {d.notes ? (
        <Card>
          <Text variant="label" color="textMuted">{r.notes}</Text>
          <Text>{d.notes}</Text>
        </Card>
      ) : null}
      {d.cancelReason ? (
        <Card>
          <Text variant="label" color="textMuted">{r.cancelReason}</Text>
          <Text>{d.cancelReason}</Text>
        </Card>
      ) : null}

      <ErrorNote message={error} action={error ? { label: b.billing, onPress: openWeb } : undefined} />
      {canArrive && <Button label={t.checkIn} icon={LogIn} onPress={() => run('check-in')} loading={stay.isPending} size="lg" fullWidth />}
      {canLeave && <Button label={t.checkOut} icon={LogOut} onPress={() => run('check-out')} loading={stay.isPending} size="lg" fullWidth />}
      <Button label={m.openOnWeb} icon={ExternalLink} variant="outline" onPress={openWeb} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  card: { paddingHorizontal: space[4] },
});
