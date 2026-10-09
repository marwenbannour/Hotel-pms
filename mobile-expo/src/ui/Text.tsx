import { Text as RNText, type TextProps } from 'react-native';
import { useI18n } from '../i18n';
import { type Palette, type, typeArabic, useTheme } from '../theme';
import type { TypeStyle } from '../theme/tokens';

interface Props extends TextProps {
  variant?: TypeStyle;
  color?: keyof Palette;
  align?: 'auto' | 'left' | 'right' | 'center';
}

/**
 * Texte de l'application : style de la charte, couleur du thème. En arabe, la même taille en
 * Noto Kufi Arabic (Poppins et Inter n'ont pas de lettres arabes).
 */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const { c } = useTheme();
  const { rtl } = useI18n();
  const base = (rtl ? typeArabic : type)[variant];
  return (
    <RNText
      {...rest}
      style={[base, { color: c[color], textAlign: align ?? 'auto', fontVariant: ['tabular-nums'] }, style]}
    />
  );
}
