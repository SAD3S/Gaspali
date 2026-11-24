import { router } from 'expo-router';
import { CalendarDays, ChartColumn, ChefHat, ChevronRight, Info, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Screen, SegmentedControl, Text, useSnackbar } from '@/components/ui';
import { seedDemo } from '@/db/inventoryRepo';
import { useAuth } from '@/features/account/AuthProvider';
import { useMembers } from '@/features/account/hooks';
import { useSyncStatus } from '@/sync/engine';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

const ENTRIES: { label: string; Icon: LucideIcon }[] = [
  { label: 'Recettes', Icon: ChefHat },
  { label: 'Planning des repas', Icon: CalendarDays },
  { label: 'Statistiques', Icon: ChartColumn },
  { label: 'Réglages', Icon: Settings },
  { label: 'À propos', Icon: Info },
];

/** Résumé du compte : foyer, membres, état de la synchro. */
function AccountCard() {
  const { colors } = useTheme();
  const auth = useAuth();
  const members = useMembers();
  const sync = useSyncStatus();
  const title = auth.active ? auth.active.name : auth.session ? 'Ton foyer' : 'Compte et foyer';
  const subtitle = !auth.cloud
    ? 'Mode local : données sur ce téléphone'
    : !auth.session
      ? 'Partage ton frigo avec ton foyer'
      : !auth.active
        ? 'Crée ou rejoins un foyer'
        : [
            `${members.length || 1} membre${members.length > 1 ? 's' : ''}`,
            sync.phase === 'offline' ? 'hors ligne' : sync.phase === 'error' ? 'erreur de synchro' : sync.pending ? `${sync.pending} en attente` : 'synchronisé',
          ].join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} onPress={() => router.push('/compte')}>
      <Card style={styles.account}>
        <View style={[styles.accountIcon, { backgroundColor: colors.primarySoft }]}>
          <Users size={24} color={colors.primaryText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
          <Text variant="label" tone="secondary" numberOfLines={1}>{subtitle}</Text>
        </View>
        <ChevronRight size={20} color={colors.textSecondary} />
      </Card>
    </Pressable>
  );
}

export default function Plus() {
  const { colors, preference, setPreference } = useTheme();
  const snackbar = useSnackbar();
  return (
    <Screen>
      <Text variant="title1" accessibilityRole="header">Plus</Text>

      <AccountCard />

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

      {__DEV__ && (
        <Button
          label="Charger des produits de démo"
          variant="outline"
          onPress={() => {
            seedDemo();
            snackbar.show('8 produits de démo ajoutés');
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accountIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
