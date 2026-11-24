import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography, type TypographyVariant } from '@/theme/tokens';

type Tone = 'default' | 'secondary' | 'primary' | 'onPrimary' | 'urgent';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  color?: string;
}

/** Texte typé du design system. Respecte la taille de texte système (plafonnée à ×1,6). */
export function Text({ variant = 'body', tone = 'default', color, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const toneColor = {
    default: colors.text,
    secondary: colors.textSecondary,
    primary: colors.primaryText,
    onPrimary: colors.onPrimary,
    urgent: colors.urgent,
  }[tone];
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typography[variant], { color: color ?? toneColor }, style]}
    />
  );
}
