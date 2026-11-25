import { router } from 'expo-router';
import { BellRing, ChefHat, ScanLine, Users, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { useAuth } from '@/features/account/AuthProvider';
import { updateSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

const SLIDES: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: ScanLine,
    title: 'Scanne tes courses',
    text: 'Code-barres, date limite ou ticket de caisse : ton frigo se remplit en quelques secondes.',
  },
  {
    Icon: BellRing,
    title: 'Ne laisse plus rien périmer',
    text: 'Gaspalli te montre quoi finir en premier et te prévient au bon moment, une fois par jour au plus.',
  },
  {
    Icon: ChefHat,
    title: 'Cuisine ce qui doit partir',
    text: 'Des recettes et un planning de la semaine qui utilisent d’abord tes produits les plus urgents.',
  },
];

/** Présentation du premier lancement (3 écrans), puis compte / foyer ou mode local. */
export default function Bienvenue() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const auth = useAuth();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = SLIDES.length; // la dernière page est le choix du mode

  const goTo = (p: number) => {
    scroller.current?.scrollTo({ x: p * width, animated: true });
    setPage(p);
  };

  const finish = (next: '/' | '/compte' | '/compte/connexion') => {
    updateSettings({ onboardingDone: true });
    router.replace(next);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (p !== page) setPage(p);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Text variant="title2" style={{ color: colors.primaryText }}>Gaspalli</Text>
        {page < last && (
          <Pressable accessibilityRole="button" onPress={() => goTo(last)} hitSlop={10} style={styles.skip}>
            <Text variant="label" tone="secondary" style={styles.bold}>Passer</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={64}
        style={styles.flex}
      >
        {SLIDES.map(({ Icon, title, text }) => (
          <View key={title} style={[styles.page, { width }]} accessible accessibilityLabel={`${title}. ${text}`}>
            <View style={[styles.visual, { backgroundColor: colors.primarySoft }]}>
              <Icon size={84} color={colors.primaryText} strokeWidth={1.5} />
            </View>
            <Text variant="title1" style={styles.center}>{title}</Text>
            <Text variant="body" tone="secondary" style={[styles.center, styles.text]}>{text}</Text>
          </View>
        ))}

        <View style={[styles.page, { width }]}>
          <View style={[styles.visual, { backgroundColor: colors.primarySoft }]}>
            <Users size={84} color={colors.primaryText} strokeWidth={1.5} />
          </View>
          <Text variant="title1" style={styles.center}>On commence ?</Text>
          <Text variant="body" tone="secondary" style={[styles.center, styles.text]}>
            {auth.cloud
              ? 'Avec un compte, tu partages le frigo, les courses et le planning avec ton foyer, en temps réel. Sans compte, tout reste sur ce téléphone.'
              : 'Tes données restent sur ce téléphone. Pas de publicité, rien n’est revendu.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: last + 1, now: page + 1 }}>
          {Array.from({ length: last + 1 }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === page ? colors.primary : colors.border, width: i === page ? 22 : 8 }]} />
          ))}
        </View>
        {page < last ? (
          <Button size="lg" label="Suivant" onPress={() => goTo(page + 1)} />
        ) : auth.cloud ? (
          <>
            <Button size="lg" label="Créer un foyer ou le rejoindre" onPress={() => finish(auth.session ? '/compte' : '/compte/connexion')} />
            <Button label="Continuer sans compte" variant="outline" onPress={() => finish('/')} />
          </>
        ) : (
          <Button size="lg" label="C’est parti" onPress={() => finish('/')} />
        )}
        <Pressable accessibilityRole="link" onPress={() => router.push('/confidentialite')} hitSlop={8} style={styles.privacy}>
          <Text variant="label" tone="secondary" style={styles.center}>Confidentialité et données</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: 'DMSans_700Bold' },
  center: { textAlign: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: MIN_TOUCH + 8 },
  skip: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  visual: { width: 180, height: 180, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  text: { maxWidth: 340, fontSize: 16, lineHeight: 23 },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 },
  dot: { height: 8, borderRadius: 4 },
  privacy: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});
