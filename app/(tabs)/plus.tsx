import { CalendarDays, ChartColumn, ChefHat, Info, Settings, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Card, Screen, SegmentedControl, Text } from '@/components/ui';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

const ENTRIES: { label: string; Icon: LucideIcon }[] = [
  { label: 'Recettes', Icon: ChefHat },
  { label: 'Planning des repas', Icon: CalendarDays },
  { label: 'Statistiques', Icon: ChartColumn },
  { label: 'Réglages', Icon: Settings },
  { label: 'À propos', Icon: Info },
];

export default function Plus() {
  const { colors, preference, setPreference } = useTheme();
  return (
    <Screen>
      <Text variant="title1" accessibilityRole="header">Plus</Text>

      <Card style={{ gap: 12 }}>
        <Text variant="bodyStrong">Thème</Text>
        <SegmentedControl<ThemePreference>
          accessibilityLabel="Thème de l'application"
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />
      </Card>

      <Card style={{ paddingVertical: 6 }}>
        {ENTRIES.map(({ label, Icon }, i) => (
          <View key={label} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Icon size={22} color={colors.primaryText} />
            <Text variant="body">{label}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52 },
});
