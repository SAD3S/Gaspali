import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { startOfDay } from '@/domain/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const JOURS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Grille du mois (semaines commençant le lundi), cases vides = null. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

interface Props {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (d: Date) => void;
  title?: string;
}

/** Sélecteur de date en JS pur (identique iOS / Android / web). */
export function CalendarSheet({ visible, value, onClose, onConfirm, title = 'Choisir une date' }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(startOfDay(value));
  const [cursor, setCursor] = useState({ y: value.getFullYear(), m: value.getMonth() });
  const today = startOfDay(new Date()).getTime();

  const shift = (n: number) => {
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <Text variant="title2">{title}</Text>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="Mois précédent" onPress={() => shift(-1)} style={styles.nav}>
            <ChevronLeft size={22} color={colors.text} />
          </Pressable>
          <Text variant="bodyStrong" accessibilityRole="header">{MOIS[cursor.m]} {cursor.y}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Mois suivant" onPress={() => shift(1)} style={styles.nav}>
            <ChevronRight size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {JOURS.map((j, i) => (
            <View key={`h${i}`} style={styles.cell}>
              <Text variant="label" tone="secondary">{j}</Text>
            </View>
          ))}
          {monthGrid(cursor.y, cursor.m).map((d, i) => {
            if (!d) return <View key={`e${i}`} style={styles.cell} />;
            const sel = d.getTime() === selected.getTime();
            const isToday = d.getTime() === today;
            return (
              <Pressable
                key={d.getTime()}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${JOURS_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MOIS[d.getMonth()]?.toLowerCase()}`}
                onPress={() => setSelected(d)}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    sel && { backgroundColor: colors.primary },
                    !sel && isToday && { borderWidth: 1, borderColor: colors.primary },
                  ]}
                >
                  <Text variant="body" color={sel ? colors.onPrimary : colors.text} style={sel && { fontFamily: 'DMSans_700Bold' }}>
                    {d.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button label="Valider" onPress={() => onConfirm(selected)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
