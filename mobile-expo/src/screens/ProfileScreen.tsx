import { ChevronRight, LogOut, Server } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { leaves, useMe, useNavigationMenu } from '../api/queries';
import { useI18n } from '../i18n';
import { NATIVE_PATHS } from '../navigation/paths';
import { useSession } from '../navigation/session';
import type { TabScreenProps } from '../navigation/types';
import { radius, space, type ThemePreference, useTheme } from '../theme';
import { Button, Card, FilterChips, Icon, Loading, MENU_ICONS, Screen, SectionTitle, Text } from '../ui';

/** Profil (charte HOTELIA, écran 8) : identité, autres écrans, apparence, serveur, déconnexion. */
export function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const { c, preference, setPreference } = useTheme();
  const { t, m } = useI18n();
  const me = useMe();
  const menu = useNavigationMenu();
  const { origin, signOut, changeServer } = useSession();
  if (!me.data) return <Loading />;

  const initials = me.data.fullName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  // Écrans du menu qui n'ont pas encore leur version native : ouverts en version web.
  const others = leaves(menu.data ?? []).filter((e) => e.path && !NATIVE_PATHS.has(e.path));

  return (
    <Screen safeTop>
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
          <Text variant="title1" color="accentText">{initials}</Text>
        </View>
        <Text variant="title1" align="center" accessibilityRole="header">{me.data.fullName}</Text>
        <Text color="textMuted" align="center">{m.roles[me.data.role] ?? me.data.role} · {me.data.email}</Text>
      </View>

      {others.length > 0 && (
        <View style={styles.group}>
          <SectionTitle title={m.otherScreens} />
          <Card padded={false}>
            {others.map((e, i) => {
              const glyph = e.icon ? MENU_ICONS[e.icon] : undefined;
              return (
                <Pressable
                  key={e.key}
                  onPress={() => navigation.navigate('Web', { path: e.path!, title: e.label })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.item, i > 0 && { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }, pressed && { opacity: 0.7 }]}
                >
                  {glyph ? <Icon icon={glyph} color="textMuted" /> : null}
                  <Text variant="bodyLg" style={styles.flex}>{e.label}</Text>
                  <Icon icon={ChevronRight} color="textFaint" />
                </Pressable>
              );
            })}
          </Card>
        </View>
      )}

      <View style={styles.group}>
        <SectionTitle title={m.appearance} />
        <FilterChips<ThemePreference>
          label={m.appearance}
          value={preference}
          onChange={setPreference}
          options={(['system', 'light', 'dark'] as const).map((p) => ({ value: p, label: m.themes[p] }))}
        />
      </View>

      <View style={styles.group}>
        <SectionTitle title={m.server} />
        <Card>
          <View style={styles.serverRow}>
            <Icon icon={Server} color="textMuted" />
            <Text style={styles.flex} numberOfLines={1}>{origin}</Text>
          </View>
          <Button label={t.changeServer} variant="ghost" onPress={changeServer} style={styles.left} />
        </Card>
      </View>

      <Button label={t.signOut} icon={LogOut} variant="danger" onPress={signOut} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { alignItems: 'center', gap: space[2], paddingVertical: space[4] },
  avatar: { width: 80, height: 80, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  group: { gap: space[3] },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingHorizontal: space[4] },
  serverRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  left: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
