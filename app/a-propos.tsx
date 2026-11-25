import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, ExternalLink, Leaf, Mail } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Card, Screen, Text } from '@/components/ui';
import { APP_ENV, CONTACT_EMAIL } from '@/config';
import { updateSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

const OFF_URL = 'https://world.openfoodfacts.org';

function versionLabel(): string {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '?';
  const build = Application.nativeBuildVersion;
  return `Version ${version}${build ? ` (${build})` : ''}${APP_ENV !== 'production' ? ` · ${APP_ENV}` : ''}`;
}

function Row({ label, onPress, external }: { label: string; onPress: () => void; external?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole={external ? 'link' : 'button'} onPress={onPress} style={styles.row}>
      <Text variant="body" style={styles.flex}>{label}</Text>
      {external ? <ExternalLink size={18} color={colors.textSecondary} /> : <ChevronRight size={20} color={colors.textSecondary} />}
    </Pressable>
  );
}

/** À propos : version, sources des données (Open Food Facts, ODbL), licences, liens utiles. */
export default function APropos() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={styles.flex}>À propos</Text>
      </View>

      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Leaf size={34} color={colors.onPrimary} />
        </View>
        <Text variant="title2">Gaspalli</Text>
        <Text variant="body" tone="secondary">Moins de gaspi, plus de goût.</Text>
        <Text variant="label" tone="secondary">{versionLabel()}</Text>
      </View>

      <Card style={{ gap: 8 }}>
        <Text variant="bodyStrong" accessibilityRole="header">Données produits : Open Food Facts</Text>
        <Text variant="body" tone="secondary">
          Les informations des produits scannés (nom, marque, image, Nutri-Score, allergènes) proviennent d’Open Food Facts, base de
          données collaborative, libre et ouverte, publiée sous licence Open Database License (ODbL). Les images des produits sont sous
          licence Creative Commons Attribution – Partage dans les mêmes conditions.
        </Text>
        <Text variant="body" tone="secondary">Un produit manque ? Ajoute-le avec l’application Open Food Facts : tout le monde en profite.</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(OFF_URL)} style={styles.link}>
          <ExternalLink size={16} color={colors.primaryText} />
          <Text variant="label" tone="primary" style={styles.bold}>openfoodfacts.org</Text>
        </Pressable>
      </Card>

      <Card style={{ gap: 8 }}>
        <Text variant="bodyStrong" accessibilityRole="header">Crédits</Text>
        <Text variant="body" tone="secondary">
          Lecture des dates et des tickets sur le téléphone : ML Kit (Google) et Vision (Apple). Idées de recettes par IA : Claude
          (Anthropic) ; vérifie toujours les allergènes d’une recette inventée. Polices Bricolage Grotesque et DM Sans (SIL Open Font
          License), icônes Lucide (licence ISC).
        </Text>
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <Row label="Confidentialité et données" onPress={() => router.push('/confidentialite')} />
        <View style={[styles.sep, { backgroundColor: colors.border }]} />
        <Row
          label="Revoir la présentation"
          onPress={() => {
            updateSettings({ onboardingDone: false });
            router.replace('/bienvenue');
          }}
        />
        {CONTACT_EMAIL && (
          <>
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Gaspalli`)} style={styles.row}>
              <Text variant="body" style={styles.flex}>Nous écrire</Text>
              <Mail size={18} color={colors.textSecondary} />
            </Pressable>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: 'DMSans_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  logo: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 10 },
  sep: { height: StyleSheet.hairlineWidth },
});
