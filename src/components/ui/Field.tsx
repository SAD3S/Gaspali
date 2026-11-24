import { useState, type ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';
import { Text } from './Text';

type Props = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string | null;
  hint?: string;
};

/** Champ de saisie avec libellé, aide et message d'erreur. */
export function Field({ label, error, hint, style, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="secondary">{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        accessibilityHint={hint}
        maxFontSizeMultiplier={1.6}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.urgent : focused ? colors.primary : colors.border,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="label" tone="urgent" accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text variant="label" tone="secondary">{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { fontFamily: 'DMSans_500Medium', fontSize: 17, borderWidth: 1.5, borderRadius: radius.button, paddingHorizontal: 14, minHeight: MIN_TOUCH + 8 },
});
