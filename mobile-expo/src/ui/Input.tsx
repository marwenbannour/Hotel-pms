import type { LucideIcon } from 'lucide-react-native';
import { type ComponentRef, type Ref, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useI18n } from '../i18n';
import { radius, size, space, type, typeArabic, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  icon?: LucideIcon;
  /** Élément à droite du champ (bouton œil, effacer). */
  accessory?: React.ReactNode;
  /** Valeur toujours de gauche à droite (email, numéro, adresse), même en arabe. */
  ltr?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Champ de saisie : libellé au-dessus, aide ou erreur en dessous, contour or au focus. */
export function Input({ label, error, hint, icon, accessory, ltr, style, ref, ...rest }: Props) {
  const { c } = useTheme();
  const { rtl } = useI18n();
  const [focused, setFocused] = useState(false);
  const border = error ? c.errorText : focused ? c.accent : c.lineControl;
  return (
    <View style={styles.field}>
      <Text variant="label" color="textMuted">{label}</Text>
      <View style={[styles.box, { borderColor: border, borderWidth: focused || error ? 2 : 1, backgroundColor: c.surface }]}>
        {icon && <Icon icon={icon} color="textFaint" />}
        <TextInput
          ref={ref}
          {...rest}
          accessibilityLabel={label}
          placeholderTextColor={c.textFaint}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            (rtl && !ltr ? typeArabic : type).bodyLg,
            styles.input,
            { color: c.text, writingDirection: ltr ? 'ltr' : 'auto', textAlign: ltr ? 'left' : rtl ? 'right' : 'left' },
            style,
          ]}
        />
        {accessory}
      </View>
      {error ? (
        <Text variant="caption" color="errorText" accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[1] },
  box: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: size.touchTargetLg, paddingHorizontal: space[3], borderRadius: radius.md },
  input: { flex: 1, paddingVertical: space[2], margin: 0 },
});
