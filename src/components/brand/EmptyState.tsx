import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { Pepin, type PepinMood } from './Pepin';

/** Écran ou liste vide : Pépin, un titre, une explication et, au besoin, des actions. */
export function EmptyState({ mood = 'sourire', title, text, size = 120, children }: { mood?: PepinMood; title: string; text?: string; size?: number; children?: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <Pepin size={size} mood={mood} float />
      <Text variant="bodyStrong" style={styles.center}>{title}</Text>
      {text ? <Text variant="body" tone="secondary" style={[styles.center, styles.text]}>{text}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  center: { textAlign: 'center' },
  text: { maxWidth: 340 },
});
