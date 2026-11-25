import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, ListChecks, Timer, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, Text, useSnackbar } from '@/components/ui';
import { findTimers, formatCountdown, type TimerSpan } from '@/domain/cookTimers';
import { ingredientLabel } from '@/domain/recipeEngine';
import { formatRecipeQuantity } from '@/features/recipes/IngredientChecks';
import { useRecipe } from '@/features/recipes/hooks';
import { startSystemTimer } from '@/services/androidBridge';
import { cancelTimerNotification, scheduleTimerNotification } from '@/services/notifications';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, MIN_TOUCH, radius } from '@/theme/tokens';

interface RunningTimer {
  id: string;
  label: string;
  step: number;
  endsAt: number;
  /** Notification de secours (minuteur suivi par l'app, pas par l'horloge du téléphone). */
  notificationId: string | null;
  /** Lancé dans l'horloge du téléphone : c'est elle qui sonne. */
  system: boolean;
  rang: boolean;
}

/** Mode cuisine : une étape à la fois, en grand, écran allumé ; toucher une durée lance un minuteur. */
export default function ModeCuisine() {
  useKeepAwake();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { id, portions } = useLocalSearchParams<{ id: string; portions?: string }>();
  const recipe = useRecipe(id);
  const [step, setStep] = useState(0);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(Date.now());
  const [showIngredients, setShowIngredients] = useState(false);

  // Horloge d'affichage des comptes à rebours ; petite vibration quand un minuteur de l'app se termine.
  useEffect(() => {
    if (!timers.length) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [timers.length]);
  useEffect(() => {
    const done = timers.filter((t) => !t.rang && t.endsAt <= now);
    if (!done.length) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setTimers((list) => list.map((t) => (done.some((d) => d.id === t.id) ? { ...t, rang: true } : t)));
  }, [now, timers]);

  const servings = Number(portions) || recipe?.servings || 1;
  const ratio = recipe ? servings / recipe.servings : 1;
  const steps = recipe?.steps.length ? recipe.steps : [];
  const spans = useMemo(() => findTimers(steps[step] ?? ''), [steps, step]);

  if (!recipe) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background, padding: 24, gap: 12 }]}>
        <Text variant="body">Cette recette n’existe plus.</Text>
        <Button label="Retour" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const start = async (span: TimerSpan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const message = `${recipe.title} : ${span.label}`;
    const system = startSystemTimer(span.seconds, message);
    let notificationId: string | null = null;
    if (!system) notificationId = await scheduleTimerNotification(span.seconds, 'Minuteur terminé', message).catch(() => null);
    setTimers((list) => [
      ...list,
      { id: `${Date.now()}`, label: span.label, step, endsAt: Date.now() + span.seconds * 1000, notificationId, system, rang: false },
    ]);
    setNow(Date.now());
    snackbar.show(system ? `Minuteur de ${span.label} lancé dans l’horloge du téléphone` : `Minuteur de ${span.label} lancé`);
  };

  const stop = (t: RunningTimer) => {
    if (t.notificationId) void cancelTimerNotification(t.notificationId);
    setTimers((list) => list.filter((x) => x.id !== t.id));
    if (t.system && t.endsAt > Date.now()) snackbar.show('Pense à arrêter aussi le minuteur dans l’horloge du téléphone.');
  };

  // Texte de l'étape avec les durées en boutons.
  const text = steps[step] ?? '';
  const parts: (string | TimerSpan)[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) parts.push(text.slice(cursor, s.start));
    parts.push(s);
    cursor = s.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  const last = step >= steps.length - 1;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quitter le mode cuisine" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <X size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text variant="label" tone="secondary" numberOfLines={1}>{recipe.title} · {servings} pers.</Text>
          <Text variant="bodyStrong">Étape {Math.min(step + 1, steps.length)} sur {steps.length}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Voir les ingrédients" onPress={() => setShowIngredients(true)} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ListChecks size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.progress, { backgroundColor: colors.surface2 }]}>
        <View style={{ width: `${((step + 1) / Math.max(1, steps.length)) * 100}%`, height: 4, backgroundColor: colors.primary, borderRadius: 2 }} />
      </View>

      {timers.length > 0 && (
        <View style={styles.timers}>
          {timers.map((t) => {
            const left = (t.endsAt - now) / 1000;
            const done = left <= 0;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`${done ? 'Minuteur terminé' : `Minuteur ${formatCountdown(left)}`}, étape ${t.step + 1}. Toucher pour l’arrêter`}
                onPress={() => stop(t)}
                style={[styles.timer, { backgroundColor: done ? colors.danger : colors.primarySoft }]}
              >
                <Timer size={16} color={done ? colors.onDanger : colors.primaryText} />
                <Text variant="bodyStrong" color={done ? colors.onDanger : colors.primaryText} style={styles.mono}>
                  {done ? 'Terminé !' : formatCountdown(left)}
                </Text>
                <Text variant="label" color={done ? colors.onDanger : colors.primaryText}>· étape {t.step + 1}</Text>
                <X size={14} color={done ? colors.onDanger : colors.primaryText} />
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {steps.length === 0 ? (
          <Text variant="body" tone="secondary">Cette recette n’a pas encore d’étapes.</Text>
        ) : (
          <RNText style={[styles.stepText, { color: colors.text }]} accessibilityRole="text">
            {parts.map((p, i) =>
              typeof p === 'string' ? (
                p
              ) : (
                <RNText
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Lancer un minuteur de ${p.label}`}
                  onPress={() => void start(p)}
                  style={[styles.timeLink, { color: colors.primaryText, backgroundColor: colors.primarySoft }]}
                >
                  {' ⏱ '}{text.slice(p.start, p.end)}{' '}
                </RNText>
              ),
            )}
          </RNText>
        )}
        {spans.length > 0 && <Text variant="label" tone="secondary">Touche une durée pour lancer un minuteur.</Text>}
      </ScrollView>

      <View style={[styles.nav, { borderTopColor: colors.border }]}>
        <Button
          label="Précédente"
          variant="outline"
          icon={<ChevronLeft size={20} color={colors.text} />}
          disabled={step === 0}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          style={styles.flex}
        />
        <Button
          label={last ? 'Terminé' : 'Suivante'}
          icon={last ? undefined : <ChevronRight size={20} color={colors.onPrimary} />}
          onPress={() => (last ? router.back() : setStep((s) => s + 1))}
          style={styles.flex}
        />
      </View>

      <BottomSheet visible={showIngredients} onClose={() => setShowIngredients(false)}>
        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 10 }}>
          <Text variant="title2">Ingrédients · {servings} pers.</Text>
          {recipe.ingredients.map((ri, i) => (
            <View key={i} style={styles.ingredient}>
              <Text variant="bodyStrong" style={styles.qty}>{formatRecipeQuantity(ri.quantity != null ? ri.quantity * ratio : null, ri.unit)}</Text>
              <Text variant="body" style={styles.flex}>{ingredientLabel(ri)}{ri.optional ? ' (facultatif)' : ''}</Text>
            </View>
          ))}
          <Button label="Fermer" variant="outline" onPress={() => setShowIngredients(false)} />
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progress: { height: 4, marginHorizontal: 16, borderRadius: 2, overflow: 'hidden' },
  timers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.chip, paddingHorizontal: 14, minHeight: MIN_TOUCH },
  mono: { fontVariant: ['tabular-nums'] },
  content: { padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' },
  stepText: { fontFamily: fonts.body, fontSize: 26, lineHeight: 38 },
  timeLink: { fontFamily: fonts.bodyBold, textDecorationLine: 'underline' },
  nav: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  ingredient: { flexDirection: 'row', gap: 12, alignItems: 'baseline' },
  qty: { minWidth: 72 },
});
