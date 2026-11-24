import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';
import { Text } from './Text';

type Placement = 'bottom' | 'top';

interface Snack {
  id: number;
  message: string;
  undo?: () => void;
  placement: Placement;
}

interface SnackApi {
  /**
   * Affiche un message quelques secondes, avec « Annuler » si `undo` est fourni.
   * `top` : pour les écrans dont le bas est occupé (feuille de scan).
   */
  show: (message: string, undo?: () => void, placement?: Placement) => void;
}

const SnackContext = createContext<SnackApi>({ show: () => {} });
const DURATION = 5000;

export function SnackbarProvider({ children, bottomOffset = 110 }: { children: ReactNode; bottomOffset?: number }) {
  const { colors, scheme } = useTheme();
  const [snack, setSnack] = useState<Snack | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insets = useSafeAreaInsets();
  const show = useCallback((message: string, undo?: () => void, placement: Placement = 'bottom') => {
    if (timer.current) clearTimeout(timer.current);
    setSnack({ id: Date.now(), message, undo, placement });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setSnack(null), DURATION);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Fond inversé pour se détacher du contenu.
  const bg = colors.text;
  const fg = colors.background;

  return (
    <SnackContext.Provider value={{ show }}>
      {children}
      {snack && (
        <Animated.View
          key={snack.id}
          entering={snack.placement === 'top' ? FadeInUp : FadeInDown}
          exiting={snack.placement === 'top' ? FadeOutUp : FadeOutDown}
          style={[styles.wrap, snack.placement === 'top' ? { top: insets.top + 64 } : { bottom: bottomOffset }]}
          pointerEvents="box-none"
        >
          <View style={[styles.snack, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
            <Text variant="body" color={fg} style={styles.msg} numberOfLines={2}>{snack.message}</Text>
            {snack.undo && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Annuler"
                onPress={() => {
                  snack.undo?.();
                  setSnack(null);
                }}
                style={styles.undo}
              >
                <Text variant="bodyStrong" color={scheme === 'dark' ? colors.primarySoft : '#7DDBA8'}>Annuler</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </SnackContext.Provider>
  );
}

export const useSnackbar = () => useContext(SnackContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  snack: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingLeft: 18, paddingRight: 6, minHeight: 56, gap: 8 },
  msg: { flex: 1 },
  undo: { minHeight: MIN_TOUCH, paddingHorizontal: 12, justifyContent: 'center' },
});
