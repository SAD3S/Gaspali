import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { DayForecast } from '@/domain/inventory';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * La « météo du frigo » : 7 colonnes, une par jour, avec le nombre de produits qui arrivent à date.
 * Plus c'est proche et chargé, plus la pastille est vive.
 */
export function WeekStrip({ days, selected, onSelect }: { days: DayForecast[]; selected?: string | null; onSelect: (key: string) => void }) {
  const { colors, freshness } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel="Ce qui arrive à date les 7 prochains jours">
      {days.map((d, i) => {
        const n = d.items.length;
        const tone = n === 0 ? null : i <= 1 ? freshness.urgent : i <= 4 ? freshness.bientot : freshness.frais;
        const isSel = selected === d.key;
        return (
          <Pressable
            key={d.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : d.short} : ${n ? `${n} produit${n > 1 ? 's' : ''}` : 'rien'}`}
            onPress={() => onSelect(d.key)}
            style={[styles.day, { backgroundColor: isSel ? colors.primarySoft : 'transparent', borderColor: isSel ? colors.primary : 'transparent' }]}
          >
            <Text variant="label" tone="secondary" style={styles.small}>{d.short}</Text>
            <Text variant="label" style={styles.num}>{d.date.getDate()}</Text>
            <View style={[styles.pill, { backgroundColor: tone ? tone.bg : colors.surface2 }]}>
              <Text variant="label" color={tone ? tone.fg : colors.textSecondary} style={styles.count}>{n || '·'}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  day: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 12, borderWidth: 1, minHeight: 44 },
  small: { fontSize: 11 },
  num: { fontFamily: 'DMSans_700Bold' },
  pill: { minWidth: 26, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginTop: 2 },
  count: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
});
