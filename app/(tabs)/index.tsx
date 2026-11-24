import { router } from 'expo-router';
import { Bell, BellRing, CalendarDays, ChevronRight, Package, Refrigerator, Snowflake, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, ProductCard, Screen, Text, useSnackbar } from '@/components/ui';
import type { Location } from '@/domain/categories';
import { formatHeaderDate } from '@/domain/dates';
import { countByLocation, queryInventory } from '@/domain/inventory';
import { formatTime, joinNames } from '@/domain/notifications';
import { dayKey } from '@/domain/planner';
import { formatEuros } from '@/domain/stats';
import { itemSubtitle } from '@/features/inventory/format';
import { useInventory, useMonthStats } from '@/features/inventory/hooks';
import { usePlan, useRecipesById, useReservations, useSuggestions } from '@/features/recipes/hooks';
import { suggestionSummary } from '@/domain/recipeEngine';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { getPermission, notificationsSupported, requestPermission, type PermissionState } from '@/services/notifications';
import { RecipeVisual } from '@/features/recipes/RecipeCard';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const TILES: { loc: Location; label: string; Icon: LucideIcon }[] = [
  { loc: 'frigo', label: 'Frigo', Icon: Refrigerator },
  { loc: 'congelo', label: 'Congélo', Icon: Snowflake },
  { loc: 'placard', label: 'Placard', Icon: Package },
];

/** Proposition d'activer les rappels, au bon moment (dès qu'il y a des produits), une seule fois. */
function NotificationPrompt({ hasItems }: { hasItems: boolean }) {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const settings = useSettings();
  const [permission, setPermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    if (notificationsSupported) getPermission().then(setPermission).catch(() => {});
  }, []);

  if (!notificationsSupported || !settings.loaded || settings.notificationPromptDone || !hasItems || permission !== 'undetermined') return null;
  const { hour, minute } = settings.notifications;

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.promptHead}>
        <View style={[styles.promptIcon, { backgroundColor: colors.primarySoft }]}>
          <BellRing size={22} color={colors.primaryText} />
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }}>Ne laisse plus rien périmer</Text>
      </View>
      <Text variant="body" tone="secondary">
        Un seul rappel par jour, à {formatTime(hour, minute)}, et seulement s’il y a des produits à finir.
      </Text>
      <View style={styles.promptActions}>
        <Button
          label="Activer les rappels"
          style={{ flex: 1 }}
          onPress={async () => {
            const p = await requestPermission();
            setPermission(p);
            updateSettings({ notificationPromptDone: true });
            if (p === 'granted') snackbar.show(`Rappels activés à ${formatTime(hour, minute)}`);
          }}
        />
        <Button label="Plus tard" variant="outline" onPress={() => updateSettings({ notificationPromptDone: true })} />
      </View>
    </Card>
  );
}

/** Repas planifié pour ce midi ou ce soir, sinon un accès au planning. */
function MenuCard() {
  const { colors } = useTheme();
  const plan = usePlan();
  const byId = useRecipesById();
  const now = new Date();
  const today = dayKey(now);
  // Le midi reste affiché jusqu'à 15 h, ensuite on montre le soir.
  const meal = plan
    .filter((e) => e.date === today && !e.done && byId.has(e.recipeId) && (e.slot === 'soir' || now.getHours() < 15))
    .sort((a, b) => (a.slot === b.slot ? 0 : a.slot === 'midi' ? -1 : 1))[0];
  const recipe = meal ? byId.get(meal.recipeId) : undefined;

  if (!meal || !recipe) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/planning')}>
        <Card style={styles.menuRow}>
          <View style={[styles.promptIcon, { backgroundColor: colors.primarySoft }]}>
            <CalendarDays size={22} color={colors.primaryText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Planning des repas</Text>
            <Text variant="label" tone="secondary">Planifie ta semaine avec ce qui est dans ton frigo</Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Card>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Au menu ${meal.slot === 'midi' ? 'ce midi' : 'ce soir'} : ${recipe.title}, ${meal.servings} personnes`}
      onPress={() => router.push({ pathname: '/recettes/[id]', params: { id: recipe.id, plan: meal.id, portions: String(meal.servings) } })}
    >
      <Card style={styles.menuRow}>
        <RecipeVisual recipe={recipe} size={52} rounded={14} />
        <View style={{ flex: 1 }}>
          <Text variant="overline" tone="secondary">Au menu {meal.slot === 'midi' ? 'ce midi' : 'ce soir'}</Text>
          <Text variant="bodyStrong" numberOfLines={1}>{recipe.title}</Text>
          <Text variant="label" tone="secondary">{meal.servings} pers. · {recipe.minutes} min</Text>
        </View>
        <ChevronRight size={20} color={colors.textSecondary} />
      </Card>
    </Pressable>
  );
}

export default function Accueil() {
  const { colors } = useTheme();
  const today = new Date();
  const items = useInventory();
  const stats = useMonthStats();
  const suggestions = useSuggestions();
  const reservations = useReservations();
  // Recette du jour : la mieux classée, si elle sauve au moins un produit qui périme bientôt.
  // Une recette déjà au planning n'est pas reproposée.
  const plan = usePlan();
  const planned = new Set(plan.filter((e) => !e.done && e.date >= dayKey(today)).map((e) => e.recipeId));
  const idea = suggestions.find((sg) => sg.urgentUsed + sg.soonUsed > 0 && !planned.has(sg.recipe.id)) ?? null;
  const sorted = queryInventory(items, { today });
  const urgent = sorted.filter(({ freshness: f }) => f.state === 'urgent' || f.state === 'bientot').slice(0, 3);
  const veryUrgent = sorted.filter(({ freshness: f }) => f.state === 'urgent');
  const counts = countByLocation(items);
  const alerts = sorted.filter(({ freshness: f }) => f.state === 'urgent' || f.state === 'perime').length;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="label" tone="secondary">{formatHeaderDate(today)}</Text>
          <Text variant="title1" accessibilityRole="header">Bonjour !</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={alerts ? `Alertes : ${alerts} produit${alerts > 1 ? 's' : ''} à traiter` : 'Alertes'}
          onPress={() => router.push('/alertes')}
          style={[styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Bell size={22} color={colors.text} />
          {alerts > 0 && <View style={[styles.dot, { backgroundColor: colors.urgent, borderColor: colors.surface }]} />}
        </Pressable>
      </View>

      <Card>
        <View style={styles.cardHead}>
          <Text variant="title2" accessibilityRole="header">À consommer vite</Text>
          <Pressable accessibilityRole="link" onPress={() => router.navigate('/inventaire')} hitSlop={12}>
            <Text variant="label" tone="primary" style={styles.bold}>Tout voir</Text>
          </Pressable>
        </View>
        {urgent.map(({ item, freshness: f }) => (
          <ProductCard
            key={item.id}
            variant="row"
            name={item.name}
            subtitle={itemSubtitle(item, reservations.get(item.id))}
            state={f.state}
            badgeLabel={item.row.expiryEstimated ? `≈ ${f.label}` : f.label}
            onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
          />
        ))}
        {urgent.length === 0 && (
          <Text variant="body" tone="secondary" style={{ paddingVertical: 8 }}>
            {items.length === 0 ? 'Scanne tes courses pour commencer.' : 'Rien d’urgent, tout est frais !'}
          </Text>
        )}
      </Card>

      <NotificationPrompt hasItems={items.length > 0} />

      <View style={styles.tiles}>
        {TILES.map(({ loc, label, Icon }) => (
          <Pressable
            key={loc}
            accessibilityRole="button"
            accessibilityLabel={`${label} : ${counts[loc]} produit${counts[loc] > 1 ? 's' : ''}`}
            onPress={() => router.navigate({ pathname: '/inventaire', params: { lieu: loc } })}
            style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon size={22} color={colors.primaryText} />
            <Text variant="title2" style={styles.tileCount}>{counts[loc]}</Text>
            <Text variant="label" tone="secondary">{label}</Text>
          </Pressable>
        ))}
      </View>

      <MenuCard />

      <Card tone="primary" style={{ gap: 6 }}>
        <Text variant="overline" tone="onPrimary" style={{ opacity: 0.85 }}>Idée anti-gaspi</Text>
        {idea ? (
          <>
            <Text variant="title2" tone="onPrimary">{idea.recipe.title}</Text>
            <Text variant="body" tone="onPrimary">{idea.recipe.minutes} min · {suggestionSummary(idea)}</Text>
            <View style={styles.ideaActions}>
              <Button label="Voir la recette" variant="onPrimary" style={styles.recipeBtn} onPress={() => router.push({ pathname: '/recettes/[id]', params: { id: idea.recipe.id } })} />
              <Pressable accessibilityRole="link" onPress={() => router.push('/recettes')} hitSlop={10} style={styles.otherIdeas}>
                <Text variant="label" tone="onPrimary" style={styles.bold}>Autres idées</Text>
              </Pressable>
            </View>
          </>
        ) : veryUrgent.length > 0 ? (
          <>
            <Text variant="title2" tone="onPrimary">À cuisiner en priorité</Text>
            <Text variant="body" tone="onPrimary">
              {joinNames(veryUrgent.map((r) => r.item.name))} : pense à {veryUrgent.length > 1 ? 'les ' : 'l’'}utiliser dans ton prochain repas.
            </Text>
            <Button label="Chercher une recette" variant="onPrimary" style={styles.recipeBtn} onPress={() => router.push('/recettes')} />
          </>
        ) : (
          <>
            <Text variant="title2" tone="onPrimary">Tout est sous contrôle</Text>
            <Text variant="body" tone="onPrimary">Aucun produit à finir en urgence. Envie de cuisiner quand même ?</Text>
            <Button label="Voir les recettes" variant="onPrimary" style={styles.recipeBtn} onPress={() => router.push('/recettes')} />
          </>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={styles.cardHead}>
          <Text variant="bodyStrong">Ce mois-ci</Text>
          {stats.savedPct !== null && (
            <Text variant="label" tone="secondary" accessibilityLabel={`${stats.wastedEstimated ? 'environ ' : ''}${formatEuros(stats.wastedValue)} jetés`}>
              {stats.wastedEstimated ? '≈ ' : ''}{formatEuros(stats.wastedValue)} jetés
            </Text>
          )}
        </View>
        {stats.savedPct === null ? (
          <Text variant="label" tone="secondary">
            Pas encore de données : glisse tes produits consommés ou jetés dans l’inventaire pour suivre tes progrès.
          </Text>
        ) : (
          <>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Produits sauvés ce mois-ci"
              accessibilityValue={{ min: 0, max: 100, now: stats.savedPct }}
              style={[styles.track, { backgroundColor: colors.surface2 }]}
            >
              <View style={[styles.fill, { width: `${stats.savedPct}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text variant="label" tone="secondary">
              {stats.savedPct} % de tes produits sauvés ({stats.consumed} consommé{stats.consumed > 1 ? 's' : ''}, {stats.discarded} jeté{stats.discarded > 1 ? 's' : ''})
            </Text>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bell: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bold: { fontFamily: 'DMSans_700Bold' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderWidth: 1, borderRadius: radius.tile, padding: 14, gap: 4 },
  tileCount: { marginTop: 8 },
  recipeBtn: { alignSelf: 'flex-start', marginTop: 8 },
  ideaActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  otherIdeas: { marginTop: 8, minHeight: 44, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  promptHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promptIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  promptActions: { flexDirection: 'row', gap: 10 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
