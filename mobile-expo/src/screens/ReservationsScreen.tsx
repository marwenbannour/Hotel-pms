import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useOffline } from '../api/live';
import type { Page, Reservation, ReservationStatus } from '../api/types';
import { useI18n } from '../i18n';
import type { TabScreenProps } from '../navigation/types';
import { space, useTheme } from '../theme';
import { Badge, Banner, Card, FilterChips, LoadError, RESERVATION_TONE, SearchBar, Text } from '../ui';

const STATUSES: (ReservationStatus | null)[] = [null, 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];

/** Recherche lancée 300 ms après la dernière frappe, comme le web. */
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Réservations : recherche, filtre par statut, chargement par pages. */
export function ReservationsScreen({ navigation }: TabScreenProps<'Reservations'>) {
  const { c } = useTheme();
  const { r, t, m, f } = useI18n();
  const offline = useOffline();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReservationStatus | null>(null);
  const q = useDebounced(search.trim());

  const list = useInfiniteQuery({
    queryKey: ['reservations', 'mobile', q, status],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30', sort: '-arrival_date' });
      if (q.length >= 2) params.set('q', q);
      if (status) params.set('status', status);
      if (pageParam) params.set('cursor', pageParam);
      return (await api<Page<Reservation>>(`/reservations?${params}`)).data;
    },
    getNextPageParam: (last) => last.nextCursor,
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {offline && <Banner message={t.offline} />}
      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={r.searchPlaceholder} clearLabel={r.clearFilters} />
        <FilterChips
          label={r.status}
          value={status}
          onChange={setStatus}
          options={STATUSES.map((s) => ({ value: s, label: s ? r.statuses[s] : r.allStatuses }))}
        />
      </View>
      {list.isError ? (
        <LoadError message={t.loadError} onRetry={() => list.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => { list.refetch(); }} tintColor={c.accent} colors={[c.accent]} />}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            list.isPending ? (
              <ActivityIndicator color={c.accent} style={styles.loader} />
            ) : (
              <View style={styles.empty}>
                <Text variant="bodyLg" align="center">{r.noResults}</Text>
                <Text color="textMuted" align="center">{r.noResultsHint}</Text>
              </View>
            )
          }
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={c.accent} style={styles.loader} /> : undefined}
          renderItem={({ item }) => {
            const name = `${item.guest.firstName ?? ''} ${item.guest.lastName ?? ''}`.trim();
            return (
              <Card onPress={() => navigation.navigate('Reservation', { id: item.id })} accessibilityLabel={`${name}, ${item.reference}, ${r.statuses[item.status]}`}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text variant="title2" numberOfLines={1}>{name}</Text>
                    <Text variant="caption" color="textMuted">{item.reference}</Text>
                  </View>
                  <Badge label={r.statuses[item.status]} tone={RESERVATION_TONE[item.status]} strike={item.status === 'cancelled'} />
                </View>
                <Text color="textMuted" style={styles.line}>
                  {m.stayDates(f.dayMonth(item.arrivalDate), f.dayMonth(item.departureDate), r.nightsCount(item.nights))}
                </Text>
                <View style={[styles.row, styles.line]}>
                  <Text style={styles.flex}>{item.roomType.code ?? item.roomType.name} · {t.room} {item.room?.number ?? '–'}</Text>
                  <Text variant="button">{f.money(item.totalAmount)}</Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] },
  list: { padding: space[4], gap: space[3], paddingBottom: space[12] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  line: { marginTop: space[2] },
  loader: { marginTop: space[8] },
  empty: { marginTop: space[10], gap: space[2], paddingHorizontal: space[4] },
});
