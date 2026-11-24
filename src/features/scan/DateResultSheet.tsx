import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Text } from '@/components/ui';
import type { DateCandidate } from '@/domain/dateOcr';
import { formatLongDate } from '@/domain/dates';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  visible: boolean;
  candidates: DateCandidate[];
  onConfirm: (c: DateCandidate) => void;
  onRetry: () => void;
  onClose: () => void;
}

/** Résultat de « Lire la date » : toujours confirmé par l'utilisateur. */
export function DateResultSheet({ visible, candidates, onConfirm, onRetry, onClose }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(0);
  const list = candidates.slice(0, 3);
  const chosen = list[selected] ?? list[0];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 14 }}>
        {list.length === 0 ? (
          <>
            <Text variant="title2">Pas de date trouvée</Text>
            <Text variant="body" tone="secondary">
              Rapproche-toi de la date imprimée, avec un bon éclairage, puis réessaie. Tu peux aussi utiliser les raccourcis.
            </Text>
          </>
        ) : (
          <>
            <Text variant="title2">C’est bien cette date ?</Text>
            {list.map((c, i) => {
              const sel = i === selected;
              return (
                <Pressable
                  key={c.date.getTime()}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  onPress={() => setSelected(i)}
                  style={[styles.option, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primarySoft : colors.surface }]}
                >
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{formatLongDate(c.date)} {c.date.getFullYear()}</Text>
                    <Text variant="label" tone="secondary">
                      Lu : « {c.raw} »{c.dateType ? ` · ${c.dateType}` : ''}
                    </Text>
                  </View>
                  {sel && <Check size={20} color={colors.primaryText} />}
                </Pressable>
              );
            })}
          </>
        )}
        {chosen && <Button label="Utiliser cette date" onPress={() => onConfirm(chosen)} />}
        <Button label="Réessayer" variant="outline" onPress={onRetry} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 16, padding: 14, minHeight: 56 },
});
