import { router } from 'expo-router';
import { BellRing, ChefHat, ScanLine, Users, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pepin, type PepinMood } from '@/components/brand/Pepin';
import { ThreadBackground } from '@/components/brand/ThreadBackground';
import { Button, Text } from '@/components/ui';
import { useAuth } from '@/features/account/AuthProvider';
import { EquipmentPicker } from '@/features/settings/EquipmentPicker';
import { updateSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Pépin présente l'app : une bulle (sa voix), puis le titre et l'explication. */
const SLIDES: { Icon: LucideIcon | null; mood: PepinMood; say: string; title: string; text: string }[] = [
  {
    Icon: null,
    mood: 'joie',
    say: 'Salut, moi c’est Pépin !',
    title: 'Bienvenue sur Gaspalli',
    text: 'Je t’aide à finir ce qu’il y a dans ton frigo avant qu’il ne soit trop tard. Je te montre ?',
  },
  {
    Icon: ScanLine,
    mood: 'sourire',
    say: 'Montre-moi tes courses, je retiens tout.',
    title: 'Scanne tes courses',
    text: 'Code-barres, date limite ou ticket de caisse : ton frigo se remplit en quelques secondes.',
  },
  {
    Icon: BellRing,
    mood: 'clin',
    say: 'Je te préviens avant que ça périme. Une fois par jour, pas plus.',
    title: 'Ne laisse plus rien périmer',
    text: 'Gaspalli te montre quoi finir en premier et te prévient au bon moment.',
  },
  {
    Icon: ChefHat,
    mood: 'joie',
    say: 'Et je te trouve quoi cuisiner avec ce qui doit partir.',
    title: 'Cuisine ce qui doit partir',
    text: 'Des recettes et un planning de la semaine qui utilisent d’abord tes produits les plus urgents.',
  },
];

/** Bulle de Pépin, pointe vers le bas (vers lui). */
function Bubble({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bubbleWrap}>
      <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="bodyStrong" style={styles.center}>{text}</Text>
      </View>
      <View style={[styles.tail, { backgroundColor: colors.surface, borderColor: colors.border }]} />
    </View>
  );
}

/** Pépin et le symbole de l'étape dans une pastille. */
function PepinVisual({ Icon, mood }: { Icon: LucideIcon | null; mood: PepinMood }) {
  const { colors } = useTheme();
  return (
    <View style={styles.visual}>
      <Pepin size={170} mood={mood} float />
      {Icon && (
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <Icon size={26} color={colors.onPrimary} />
        </View>
      )}
    </View>
  );
}

/** Présentation du premier lancement par Pépin (4 écrans), équipement de la cuisine, puis compte / foyer ou mode local. */
export default function Bienvenue() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const auth = useAuth();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  // Après les présentations : l'équipement de la cuisine, puis le choix du mode.
  const last = SLIDES.length + 1;

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
      <ThreadBackground variant={5} />
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
        {SLIDES.map(({ Icon, mood, say, title, text }) => (
          <View key={title} style={[styles.page, { width }]} accessible accessibilityLabel={`Pépin : ${say} ${title}. ${text}`}>
            <Bubble text={say} />
            <PepinVisual Icon={Icon} mood={mood} />
            <Text variant="title1" style={styles.center}>{title}</Text>
            <Text variant="body" tone="secondary" style={[styles.center, styles.text]}>{text}</Text>
          </View>
        ))}

        <ScrollView style={{ width }} contentContainerStyle={[styles.page, styles.kitchen]}>
          <View style={styles.kitchenHead}>
            <Pepin size={72} mood="clin" />
            <View style={[styles.bubbleSide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="bodyStrong">Dis-moi ce que tu as, je trie les recettes.</Text>
            </View>
          </View>
          <Text variant="title1" style={styles.center}>Ta cuisine</Text>
          <Text variant="body" tone="secondary" style={[styles.center, styles.text]}>
            Décoche ce que tu n’as pas : on ne te proposera pas de recette impossible. Modifiable dans Paramètres › Préférences.
          </Text>
          <EquipmentPicker />
        </ScrollView>

        <View style={[styles.page, { width }]}>
          <Bubble text={auth.cloud ? 'Tu cuisines à plusieurs ? Je partage tout avec ton foyer.' : 'C’est tout bon, on y va !'} />
          <PepinVisual Icon={auth.cloud ? Users : null} mood="joie" />
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
  kitchen: { flexGrow: 1, paddingVertical: 12, gap: 12 },
  visual: { width: 190, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badge: { position: 'absolute', right: 4, bottom: 8, width: 52, height: 52, borderRadius: 26, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  bubbleWrap: { alignItems: 'center', maxWidth: 320 },
  bubble: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12 },
  tail: { width: 16, height: 16, borderRightWidth: 1, borderBottomWidth: 1, transform: [{ rotate: '45deg' }], marginTop: -9 },
  kitchenHead: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  bubbleSide: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  text: { maxWidth: 340, fontSize: 16, lineHeight: 23 },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 },
  dot: { height: 8, borderRadius: 4 },
  privacy: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});
