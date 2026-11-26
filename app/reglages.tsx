import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Button, Card, Chip, Screen, SegmentedControl, Stepper, Text, useSnackbar } from '@/components/ui';
import { startOfDay } from '@/domain/dates';
import { formatTime, leadDaysFor, MAX_LEAD_DAYS, planNotifications } from '@/domain/notifications';
import { getCategory, type CategoryId } from '@/domain/categories';
import { useInventory } from '@/features/inventory/hooks';
import { DEFAULT_BASICS, INGREDIENTS_BY_ID } from '@/data/ingredients';
import { updateNotificationSettings, updateSettings, useSettings } from '@/features/settings/settings';
import {
  getPermission,
  notificationsSupported,
  openSystemSettings,
  requestPermission,
  sendTest,
  type PermissionState,
} from '@/services/notifications';
import { crashReportingAvailable } from '@/services/crashReporting';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

const HOURS = [8, 12, 18, 20];
/** Ingrédients qu'on peut déclarer « toujours à la maison ». */
const BASIC_CANDIDATES = [...DEFAULT_BASICS, 'moutarde', 'ail', 'oignon', 'beurre', 'lait', 'oeufs', 'riz', 'pates', 'bouillon', 'sauce_soja', 'curry', 'cumin', 'levure', 'sucre_vanille', 'cannelle', 'concentre_tomate'];

/** Catégories périssables proposées pour les délais de rappel. */
const LEAD_CATEGORIES: CategoryId[] = ['viande', 'poisson', 'laitier', 'fromage', 'oeufs', 'traiteur', 'restes', 'fruits', 'legumes', 'boulangerie'];

/** 0 → « le jour même », 1 → « la veille », 3 → « 3 j avant » */
function leadLabel(v: number): string {
  return v === 0 ? 'Le jour J' : v === 1 ? 'La veille' : `${v} j avant`;
}

function Row({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="bodyStrong" style={{ fontSize: 16 }}>{label}</Text>
        <Text variant="label" tone="secondary">{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function Reglages() {
  const { colors, preference, setPreference } = useTheme();
  const snackbar = useSnackbar();
  const { notifications: n, basics, autoRestock, crashReports, householdAlerts } = useSettings();
  const items = useInventory();
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  const refresh = useCallback(() => {
    getPermission().then(setPermission).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    // Retour depuis les réglages du téléphone.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const enabled = permission === 'granted';

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header">Réglages</Text>
      </View>

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

      <Text variant="overline" tone="secondary">Ingrédients de base</Text>
      <Card style={{ gap: 10 }}>
        <Text variant="label" tone="secondary">Considérés comme toujours disponibles dans les recettes (jamais comptés comme manquants).</Text>
        <View style={styles.wrap}>
          {BASIC_CANDIDATES.map((id) => {
            const on = basics.includes(id);
            return (
              <Chip
                key={id}
                label={INGREDIENTS_BY_ID[id]?.name ?? id}
                selected={on}
                onPress={() => updateSettings({ basics: on ? basics.filter((b) => b !== id) : [...basics, id] })}
              />
            );
          })}
        </View>
      </Card>

      <Text variant="overline" tone="secondary">Courses</Text>
      <Card>
        <Row
          label="Produits habituels"
          hint="Quand un produit acheté régulièrement est terminé, il est ajouté à la liste de courses."
          value={autoRestock}
          onChange={(v) => updateSettings({ autoRestock: v })}
        />
        <Row
          label="Prévenir des changements du foyer"
          hint="Notification quand quelqu’un d’autre ajoute des articles ou termine la liste."
          value={householdAlerts}
          onChange={(v) => updateSettings({ householdAlerts: v })}
        />
      </Card>

      {crashReportingAvailable && (
        <>
          <Text variant="overline" tone="secondary">Aide au développement</Text>
          <Card>
            <Row
              label="Rapports de plantage"
              hint="Si l’app plante, envoie un rapport technique anonyme (sans ton inventaire, ni ton nom) pour corriger le problème."
              value={crashReports}
              onChange={(v) => updateSettings({ crashReports: v })}
            />
          </Card>
        </>
      )}

      <Text variant="overline" tone="secondary">Notifications</Text>
      <Card style={{ gap: 16 }}>
        {!notificationsSupported ? (
          <Text variant="body" tone="secondary">Les rappels sont disponibles sur téléphone.</Text>
        ) : !enabled ? (
          <View style={{ gap: 10 }}>
            <Text variant="body" tone="secondary">
              {permission === 'denied'
                ? 'Les notifications sont bloquées pour Gaspalli. Autorise-les dans les réglages du téléphone.'
                : 'Autorise les notifications pour recevoir un rappel quand des produits sont à finir.'}
            </Text>
            <Button
              label={permission === 'denied' ? 'Ouvrir les réglages du téléphone' : 'Autoriser les notifications'}
              onPress={() => (permission === 'denied' ? openSystemSettings() : requestPermission().then(setPermission))}
            />
          </View>
        ) : null}

        <Row
          label="Rappel quotidien"
          hint="« 3 produits à consommer d’ici demain », seulement s’il y en a."
          value={n.dailyEnabled}
          onChange={(dailyEnabled) => updateNotificationSettings({ dailyEnabled })}
          disabled={!enabled}
        />
        <Row
          label="Veille de la DLC"
          hint="Prévenu la veille de la date limite de consommation."
          value={n.dlcEveEnabled}
          onChange={(dlcEveEnabled) => updateNotificationSettings({ dlcEveEnabled })}
          disabled={!enabled}
        />

        <View style={{ gap: 10, opacity: enabled ? 1 : 0.5 }} pointerEvents={enabled ? 'auto' : 'none'}>
          <Text variant="bodyStrong" style={{ fontSize: 16 }}>Heure du rappel</Text>
          <View style={styles.wrap}>
            {HOURS.map((h) => (
              <Chip key={h} label={`${h} h`} selected={n.hour === h && n.minute === 0} onPress={() => updateNotificationSettings({ hour: h, minute: 0 })} />
            ))}
          </View>
          <View style={styles.between}>
            <Text variant="body">Précisément : <Text variant="body" style={styles.bold}>{formatTime(n.hour, n.minute)}</Text></Text>
            <Stepper
              label="heure du rappel"
              value={n.hour * 60 + n.minute}
              step={15}
              min={0}
              format={(v) => formatTime(Math.floor(v / 60) % 24, v % 60)}
              onChange={(v) => {
                const t = ((v % 1440) + 1440) % 1440;
                updateNotificationSettings({ hour: Math.floor(t / 60), minute: t % 60 });
              }}
            />
          </View>
          <Text variant="label" tone="secondary">Jamais plus d’une notification par jour.</Text>
        </View>

        <View style={{ gap: 8, opacity: enabled && n.dailyEnabled ? 1 : 0.5 }} pointerEvents={enabled && n.dailyEnabled ? 'auto' : 'none'}>
          <Text variant="bodyStrong" style={{ fontSize: 16 }}>Prévenir plus tôt selon le produit</Text>
          <Text variant="label" tone="secondary">Par défaut, le rappel cite ce qui est à finir aujourd’hui et demain.</Text>
          {LEAD_CATEGORIES.map((id) => {
            const value = leadDaysFor(n, id);
            return (
              <View key={id} style={styles.between}>
                <Text variant="body" style={styles.flex}>{getCategory(id).label}</Text>
                <Stepper
                  label={`délai pour ${getCategory(id).label}`}
                  value={value}
                  min={0}
                  max={MAX_LEAD_DAYS}
                  format={leadLabel}
                  onChange={(v) => updateNotificationSettings({ leadDays: { ...n.leadDays, [id]: v } })}
                />
              </View>
            );
          })}
        </View>

        {enabled && (
          <Button
            label="Envoyer une notification de test"
            variant="outline"
            onPress={async () => {
              // Aperçu du rappel d'aujourd'hui (calculé depuis minuit pour ignorer l'heure réglée).
              const next = planNotifications(items, { ...n, dailyEnabled: true }, startOfDay(new Date()), 1)[0];
              await sendTest(next?.title ?? 'Gaspalli', next?.body ?? 'Rien d’urgent pour le moment. Les rappels sont bien activés.');
              snackbar.show('Notification de test dans 5 secondes');
              updateSettings({ notificationPromptDone: true });
            }}
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  bold: { fontFamily: 'DMSans_700Bold' },
});
