import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  tone?: 'surface' | 'primary';
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, tone = 'surface', style }: Props) {
  const { colors } = useTheme();
  const isPrimary = tone === 'primary';
  return (
    <View
      style={[
        {
          backgroundColor: isPrimary ? colors.primary : colors.surface,
          borderColor: isPrimary ? colors.primary : colors.border,
          borderWidth: 1,
          borderRadius: radius.card,
          padding: 18,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
