import { Search, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import { radius, size, space, type, typeArabic, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Champ de recherche arrondi, loupe et bouton d'effacement. */
export function SearchBar({ value, onChangeText, placeholder, clearLabel }: { value: string; onChangeText: (v: string) => void; placeholder: string; clearLabel: string }) {
  const { c } = useTheme();
  const { rtl } = useI18n();
  return (
    <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Icon icon={Search} color="textMuted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        style={[(rtl ? typeArabic : type).bodyLg, styles.flex, { color: c.text }]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel={clearLabel} hitSlop={12}>
          <Icon icon={X} color="textMuted" />
        </Pressable>
      )}
    </View>
  );
}

/** Filtres en pastilles (tous / un statut / un étage), défilant horizontalement. */
export function FilterChips<T extends string | number | null>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, on ? { backgroundColor: c.accent } : { backgroundColor: c.surface, borderColor: c.lineControl, borderWidth: 1 }]}
          >
            <Text variant="button" color={on ? 'onAccent' : 'text'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Ligne libellé / valeur d'une fiche. */
export function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text color="textMuted">{label}</Text>
      {typeof value === 'string' ? <Text style={styles.value}>{value}</Text> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingVertical: space[2] },
  search: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: size.touchTargetLg, paddingHorizontal: space[4], borderRadius: radius.full, borderWidth: 1 },
  chips: { gap: space[2], paddingVertical: space[1] },
  chip: { minHeight: 40, paddingHorizontal: space[4], borderRadius: radius.full, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  value: { flexShrink: 1, textAlign: 'right' },
});
