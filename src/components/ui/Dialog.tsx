import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

/** Même forme que les boutons d'Alert.alert, pour remplacer la boîte système par une boîte aux couleurs de l'app. */
export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let current: DialogState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Boîte de confirmation de l'app (remplace Alert.alert). Sans bouton : un simple « OK ». */
export function showDialog(title: string, message?: string, buttons: DialogButton[] = [{ text: 'OK' }]): void {
  current = { title, message, buttons: buttons.length ? buttons : [{ text: 'OK' }] };
  emit();
}

function close() {
  current = null;
  emit();
}

/** À monter une fois, à la racine de l'app. */
export function DialogHost() {
  const { colors } = useTheme();
  const dialog = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  if (!dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  const actions = dialog.buttons.filter((b) => b !== cancel);
  const press = (b: DialogButton) => {
    close();
    b.onPress?.();
  };
  // Deux boutons : côte à côte (Annuler à gauche). Plus : empilés, Annuler en dernier.
  const inline = actions.length <= 1;
  const ordered = inline ? [...(cancel ? [cancel] : []), ...actions] : [...actions, ...(cancel ? [cancel] : [])];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => (cancel ? press(cancel) : close())} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={() => cancel && press(cancel)} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityViewIsModal accessibilityRole="alert">
          <Text variant="title2">{dialog.title}</Text>
          {dialog.message ? <Text variant="body" tone="secondary">{dialog.message}</Text> : null}
          <View style={inline ? styles.row : styles.column}>
            {ordered.map((b) => (
              <Button
                key={b.text}
                label={b.text}
                variant={b.style === 'cancel' ? 'outline' : b.style === 'destructive' ? 'danger' : 'primary'}
                onPress={() => press(b)}
                style={inline ? styles.flex : undefined}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 22, gap: 12, maxWidth: 440, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  column: { gap: 10, marginTop: 8 },
});
