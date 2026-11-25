import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Pepin } from '@/components/brand/Pepin';
import { Button, Text } from '@/components/ui';
import { startOfWeek } from '@/domain/achievements';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { BadgeMedal } from './BadgeMedal';
import { useAchievements } from './hooks';

interface Party {
  title: string;
  subtitle: string;
  text: string;
  medal?: { icon: Parameters<typeof BadgeMedal>[0]['icon']; tier: Parameters<typeof BadgeMedal>[0]['tier'] };
}

/**
 * Pépin fête un nouveau badge ou le défi de la semaine réussi, une seule fois par téléphone.
 * Au premier lancement, les badges déjà gagnés sont notés sans fête (pas d'avalanche).
 */
export function Celebration() {
  const { colors } = useTheme();
  const { badges, challenge, ready } = useAchievements();
  const { loaded, onboardingDone, seenBadges, celebratedChallenge } = useSettings();
  const [party, setParty] = useState<Party | null>(null);

  useEffect(() => {
    if (!ready || !loaded || !onboardingDone || party) return;
    // Laisse le planning et les recettes se charger avant de comparer.
    const t = setTimeout(() => {
      const unlocked = badges.filter((b) => b.unlocked);
      if (seenBadges === null) {
        updateSettings({ seenBadges: unlocked.map((b) => b.id) });
        return;
      }
      const fresh = unlocked.filter((b) => !seenBadges.includes(b.id));
      if (fresh.length) {
        const b = fresh[fresh.length - 1]!;
        updateSettings({ seenBadges: [...seenBadges, ...fresh.map((x) => x.id)] });
        setParty({
          title: 'Nouveau badge !',
          subtitle: b.title,
          text: b.description + (fresh.length > 1 ? ` Et ${fresh.length - 1} autre${fresh.length > 2 ? 's' : ''} badge${fresh.length > 2 ? 's' : ''} débloqué${fresh.length > 2 ? 's' : ''} !` : ''),
          medal: { icon: b.icon, tier: b.tier },
        });
        return;
      }
      const key = `${startOfWeek(new Date()).getTime()}-${challenge.id}`;
      if (challenge.done && celebratedChallenge !== key) {
        updateSettings({ celebratedChallenge: key });
        setParty({ title: 'Défi réussi !', subtitle: challenge.title, text: 'Bravo, défi de la semaine relevé. Un nouveau t’attend lundi.' });
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, loaded, onboardingDone, badges, challenge, seenBadges, celebratedChallenge, party]);

  if (!party) return null;
  const close = () => setParty(null);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityViewIsModal>
          <View style={styles.art}>
            <Pepin size={120} mood="joie" float />
            {party.medal && (
              <View style={styles.medal}>
                <BadgeMedal icon={party.medal.icon} tier={party.medal.tier} unlocked size={64} />
              </View>
            )}
          </View>
          <Text variant="label" tone="primary" style={styles.center}>{party.title}</Text>
          <Text variant="title2" style={styles.center}>{party.subtitle}</Text>
          <Text variant="body" tone="secondary" style={styles.center}>{party.text}</Text>
          <View style={styles.row}>
            <Button label="Super" variant="outline" onPress={close} style={styles.flex} />
            <Button
              label="Mes badges"
              onPress={() => {
                close();
                router.push('/defis');
              }}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, padding: 22, gap: 8, maxWidth: 420, width: '100%', alignSelf: 'center', alignItems: 'stretch' },
  art: { alignItems: 'center', justifyContent: 'center', height: 140 },
  medal: { position: 'absolute', right: '18%', bottom: 0 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
});
