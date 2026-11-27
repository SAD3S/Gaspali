import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { FreshnessState } from '@/theme/tokens';
import { Text } from './Text';

/** « Blanc de poulet » → « Po » si `initials` n'est pas fourni : 2 premières lettres du nom. */
export function initialsOf(name: string): string {
  const clean = name.trim();
  return (clean.charAt(0).toUpperCase() + clean.charAt(1).toLowerCase()) || '?';
}

interface Props {
  name: string;
  initials?: string;
  imageUri?: string;
  state: FreshnessState;
  size?: number;
}

export function ProductAvatar({ name, initials, imageUri, state, size = 46 }: Props) {
  const { freshness } = useTheme();
  const s = freshness[state];
  const box = { width: size, height: size, borderRadius: size * 0.3 };
  // Photo absente (prise sur l'autre téléphone du foyer, supprimée…) : on revient aux initiales.
  const [failed, setFailed] = useState<string | null>(null);
  if (imageUri && failed !== imageUri) {
    return <Image source={{ uri: imageUri }} style={box} accessibilityIgnoresInvertColors onError={() => setFailed(imageUri)} />;
  }
  return (
    <View style={[styles.box, box, { backgroundColor: s.bg }]} importantForAccessibility="no-hide-descendants">
      <Text variant="bodyStrong" color={s.fg} style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: size * 0.4 }}>
        {initials ?? initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center' } });
