import { router } from 'expo-router';
import { ChartColumn, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Pepin } from '@/components/brand/Pepin';
import { BottomSheet, Button, Card, Screen, Text } from '@/components/ui';
import type { Badge } from '@/domain/achievements';
import { BadgeMedal, TIER_COLORS, TIER_LABELS } from '@/features/achievements/BadgeMedal';
import { useAchievements } from '@/features/achievements/hooks';
import { Progress } from '@/features/achievements/Progress';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, MIN_TOUCH } from '@/theme/tokens';

/** Défis et badges : série sans gaspillage, défi de la semaine, médailles du foyer. */
export default function Defis() {
  const { colors } = useTheme();
  const { streak, challenge, badges, unlocked } = useAchievements();
  const [open, setOpen] = useState<Badge | null>(null);
  const mood = !streak.started ? 'sourire' : streak.current === 0 ? 'oups' : streak.current >= 3 ? 'joie' : 'sourire';

  return (
    <Screen thread={6}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={styles.flex}>Défis et badges</Text>
      </View>

      <Card style={styles.hero}>
        <Pepin size={96} mood={mood} float />
        <View style={styles.flex}>
          {streak.started ? (
            <>
              <Text style={[styles.big, { color: colors.primaryText }]}>{streak.current}</Text>
              <Text variant="bodyStrong">jour{streak.current > 1 ? 's' : ''} sans rien jeter</Text>
              <Text variant="label" tone="secondary">
                {streak.current === 0 ? 'Un produit jeté aujourd’hui : ta série repart demain.' : `Record : ${streak.best} jour${streak.best > 1 ? 's' : ''}`}
              </Text>
            </>
          ) : (
            <>
              <Text variant="bodyStrong">Ta série commence avec ton premier produit</Text>
              <Text variant="label" tone="secondary">Chaque jour sans rien jeter la fait grandir.</Text>
            </>
          )}
        </View>
      </Card>

      <Text variant="overline" tone="secondary" accessibilityRole="header">Défi de la semaine</Text>
      <Card style={[styles.challenge, challenge.done && { borderColor: colors.primary, borderWidth: 2 }]}>
        <Text variant="title2">{challenge.title}</Text>
        <Text variant="body" tone="secondary">{challenge.description}</Text>
        <Progress value={challenge.current / challenge.target} color={challenge.failed ? colors.textSecondary : undefined} />
        <View style={styles.row}>
          <Text variant="label" style={[styles.bold, styles.flex]} tone={challenge.done ? 'primary' : challenge.failed ? 'secondary' : 'default'}>
            {challenge.done ? 'Défi réussi, bravo !' : challenge.progressLabel}
          </Text>
          {!challenge.done && !challenge.failed && (
            <Text variant="label" tone="secondary">encore {challenge.daysLeft} jour{challenge.daysLeft > 1 ? 's' : ''}</Text>
          )}
        </View>
      </Card>

      <View style={styles.row}>
        <Text variant="overline" tone="secondary" accessibilityRole="header" style={styles.flex}>Badges · {unlocked} sur {badges.length}</Text>
      </View>
      <View style={styles.grid}>
        {badges.map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={`${b.title}, ${b.unlocked ? 'débloqué' : `verrouillé, ${b.current} sur ${b.target}`}`}
            onPress={() => setOpen(b)}
            style={[styles.cell, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <BadgeMedal icon={b.icon} tier={b.tier} unlocked={b.unlocked} />
            <Text variant="label" style={[styles.bold, styles.center]} numberOfLines={2}>{b.title}</Text>
            {!b.unlocked && b.target > 1 && (
              <View style={{ alignSelf: 'stretch', gap: 3 }}>
                <Progress value={b.current / b.target} />
                <Text variant="label" tone="secondary" style={[styles.center, styles.small]}>{b.current} / {b.target}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <Button label="Voir les statistiques" variant="outline" icon={<ChartColumn size={18} color={colors.text} />} onPress={() => router.push('/statistiques')} />

      <BottomSheet visible={open !== null} onClose={() => setOpen(null)}>
        {open && (
          <View style={{ gap: 12, alignItems: 'center' }}>
            <BadgeMedal icon={open.icon} tier={open.tier} unlocked={open.unlocked} size={96} />
            <Text variant="title2" style={styles.center}>{open.title}</Text>
            <Text variant="label" style={[styles.bold, { color: TIER_COLORS[open.tier] }]}>{TIER_LABELS[open.tier]}</Text>
            <Text variant="body" tone="secondary" style={styles.center}>{open.description}</Text>
            {!open.unlocked && (
              <View style={{ alignSelf: 'stretch', gap: 6 }}>
                <Progress value={open.current / open.target} />
                <Text variant="label" tone="secondary" style={styles.center}>{open.current} / {open.target}</Text>
              </View>
            )}
            {open.unlocked && <Text variant="bodyStrong" tone="primary">Débloqué !</Text>}
            <Button label="Fermer" variant="outline" onPress={() => setOpen(null)} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  big: { fontFamily: fonts.title, fontSize: 52, lineHeight: 56 },
  challenge: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontFamily: fonts.bodyBold },
  center: { textAlign: 'center' },
  small: { fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 8 },
});
