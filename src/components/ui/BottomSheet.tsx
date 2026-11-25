import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

/** Surface de feuille (poignée + coins arrondis), utilisable seule ou dans <BottomSheet>. */
export function Sheet({ children, style, keyboard = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; keyboard?: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          // Clavier ouvert : la feuille remonte au-dessus et ne dépasse jamais le haut de l'écran.
          paddingBottom: keyboard ? 16 : 16 + insets.bottom,
          marginBottom: keyboard,
          maxHeight: height - keyboard - insets.top - 12,
        },
        style,
      ]}
    >
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
  const keyboard = useKeyboardHeight(visible);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <Sheet keyboard={keyboard}>{children}</Sheet>
      </View>
    </Modal>
  );
}

/**
 * Hauteur du clavier. Dans une fenêtre modale en plein écran (Android bord à bord), le système ne
 * redimensionne pas la vue : il faut remonter le contenu soi-même.
 */
function useKeyboardHeight(active: boolean): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!active) {
      setHeight(0);
      return;
    }
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active]);
  return height;
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
});
