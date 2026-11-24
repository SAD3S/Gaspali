import { router } from 'expo-router';
import { CalendarDays, ChartColumn, ChefHat, ChevronRight, Info, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Screen, Text, useSnackbar } from '@/components/ui';
import { seedDemo } from '@/db/inventoryRepo';
import { useAuth } from '@/features/account/AuthProvider';
import { useMembers } from '@/features/account/hooks';
import { useSyncStatus } from '@/sync/engine';
import { useTheme } from '@/theme/ThemeProvider';

const ENTRIES: { label: string; Icon: LucideIcon; href?: '/reglages'; soon?: string }[] = [
  { label: 'Recettes', Icon: ChefHat, soon: 'Étape 6' },
  { label: 'Planning des repas', Icon: CalendarDays, soon: 'Étape 8' },
  { label: 'Statistiques', Icon: ChartColumn, soon: 'Étape 8' },
  { label: 'Réglages', Icon: Settings, href: '/reglages' },
  { label: 'À propos', Icon: Info, soon: 'Étape 10' },
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
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  return (
    <Screen>
      <Text variant="title1" accessibilityRole="header">Plus</Text>

      <AccountCard />

      <Card style={{ paddingVertical: 6 }}>
        {ENTRIES.map(({ label, Icon, href, soon }, i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={soon ? `${label}, bientôt disponible` : label}
            accessibilityState={{ disabled: !href }}
            disabled={!href}
            onPress={() => href && router.push(href)}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
          >
            <Icon size={22} color={href ? colors.primaryText : colors.textSecondary} />
            <Text variant="body" style={{ flex: 1 }} color={href ? colors.text : colors.textSecondary}>{label}</Text>
            {href ? <ChevronRight size={20} color={colors.textSecondary} /> : <Text variant="label" tone="secondary">Bientôt</Text>}
          </Pressable>
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
