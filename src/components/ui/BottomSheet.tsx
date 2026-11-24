import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

/** Surface de feuille (poignée + coins arrondis), utilisable seule ou dans <BottomSheet>. */
export function Sheet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: 16 + insets.bottom }, style]}>
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
      {children}
    </View>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Feuille modale qui glisse depuis le bas ; toucher le voile la ferme. */
export function BottomSheet({ visible, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <Sheet>{children}</Sheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
});
