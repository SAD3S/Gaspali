import { router } from 'expo-router';
import { ChevronRight, Flame } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { BadgeMedal } from './BadgeMedal';
import { useAchievements } from './hooks';
import { Progress } from './Progress';

/** Carte de l'accueil : série, défi de la semaine et derniers badges, vers l'écran des défis. */
export function ChallengeCard() {
  const { colors } = useTheme();
  const { streak, challenge, badges, unlocked } = useAchievements();
  const shown = badges.filter((b) => b.unlocked).slice(-4);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Défis et badges : ${streak.current} jours sans rien jeter, défi ${challenge.title}, ${challenge.progressLabel}, ${unlocked} badges`} onPress={() => router.push('/defis')}>
      <Card style={{ gap: 10 }}>
        <View style={styles.head}>
          <Text variant="bodyStrong" style={styles.flex}>Défis</Text>
          {streak.started && (
            <View style={[styles.streak, { backgroundColor: colors.primarySoft }]}>
              <Flame size={16} color={streak.current ? colors.urgent : colors.textSecondary} />
              <Text variant="label" tone="primary" style={styles.bold}>{streak.current} j sans gâchis</Text>
            </View>
          )}
          <ChevronRight size={20} color={colors.textSecondary} />
        </View>
        <Text variant="body">{challenge.title}</Text>
        <Progress value={challenge.current / challenge.target} color={challenge.failed ? colors.textSecondary : undefined} />
        <View style={styles.head}>
          <Text variant="label" tone={challenge.done ? 'primary' : 'secondary'} style={[styles.flex, challenge.done && styles.bold]}>
            {challenge.done ? 'Défi réussi, bravo !' : challenge.progressLabel}
          </Text>
          <View style={styles.medals}>
            {shown.map((b) => <BadgeMedal key={b.id} icon={b.icon} tier={b.tier} unlocked size={28} />)}
            <Text variant="label" tone="secondary">{unlocked}/{badges.length}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  bold: { fontFamily: fonts.bodyBold },
  medals: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
