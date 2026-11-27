import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Pepin } from '@/components/brand/Pepin';
import { Button, Screen, Text, useSnackbar } from '@/components/ui';
import { eventsSinceQuery } from '@/db/inventoryRepo';
import { monthRecap, type MonthRecap } from '@/domain/recap';
import { formatEuros } from '@/domain/stats';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, MIN_TOUCH } from '@/theme/tokens';

/** Couleurs fixes de la carte : la même image, quel que soit le thème du téléphone. */
const CARD = { bg: '#1F7A4D', ink: '#FFFFFF', soft: '#DDEFE3', tile: '#17603C' };

function summary(r: MonthRecap): string {
  return (
    `Notre mois de ${r.label} avec Gaspalli : ${r.saved} produit${r.saved > 1 ? 's' : ''} sauvé${r.saved > 1 ? 's' : ''}, ` +
    `${formatEuros(r.savedValue)} économisés, ${r.wasteFreeDays} jours sans gâchis et environ ${r.co2Kg} kg de CO₂ évités.`
  );
}

/** Bilan du mois façon « Wrapped » : une carte à garder ou à partager. */
export default function Bilan() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { mois } = useLocalSearchParams<{ mois?: string }>();
  const now = new Date();
  // Début de mois : on montre le mois qui vient de finir.
  const initial = mois ? new Date(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)) - 1, 1) : new Date(now.getFullYear(), now.getMonth() - (now.getDate() <= 5 ? 1 : 0), 1);
  const [start, setStart] = useState(initial);
  const { data } = useLiveQuery(eventsSinceQuery(start), [start.getTime()]);
  const r = useMemo(() => monthRecap(data ?? [], start, now), [data, start.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = useRef<HostInstance>(null);
  const isCurrent = start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();

  const share = async () => {
    try {
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(card, { format: 'png', quality: 1 });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Partager le bilan' });
      } else {
        await Share.share({ message: summary(r) });
      }
    } catch {
      snackbar.show('Partage impossible pour le moment');
    }
  };

  const tiles: { big: string; small: string }[] = [
    { big: String(r.saved), small: `produit${r.saved > 1 ? 's' : ''} sauvé${r.saved > 1 ? 's' : ''}` },
    { big: formatEuros(r.savedValue), small: 'économisés' },
    { big: r.savedPct == null ? '–' : `${r.savedPct} %`, small: 'des produits mangés' },
    { big: `${r.wasteFreeDays}/${r.daysCounted}`, small: 'jours sans gâchis' },
  ];

  return (
    <Screen thread={10}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={styles.flex}>Mon bilan</Text>
      </View>

      <View style={styles.monthNav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mois précédent" onPress={() => setStart(new Date(start.getFullYear(), start.getMonth() - 1, 1))} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
        <Text variant="bodyStrong" style={[styles.flex, styles.center]}>{r.label}{isCurrent ? ' (en cours)' : ''}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
          disabled={isCurrent}
          onPress={() => setStart(new Date(start.getFullYear(), start.getMonth() + 1, 1))}
          style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border, opacity: isCurrent ? 0.35 : 1 }]}
        >
          <ChevronRight size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* La carte partagée en image */}
      <View ref={card} collapsable={false} style={[styles.card, { backgroundColor: CARD.bg }]}>
        <View style={styles.cardHead}>
          <View style={[styles.pepin, { backgroundColor: CARD.soft }]}>
            <Pepin size={64} mood={r.saved > r.wasted ? 'joie' : 'sourire'} />
          </View>
          <View style={styles.flex}>
            <Text variant="label" color={CARD.soft}>Notre mois anti-gaspi</Text>
            <Text style={[styles.title, { color: CARD.ink }]}>{r.label.charAt(0).toUpperCase() + r.label.slice(1)}</Text>
          </View>
        </View>

        <View style={styles.tiles}>
          {tiles.map((t) => (
            <View key={t.small} style={[styles.tile, { backgroundColor: CARD.tile }]}>
              <Text style={[styles.big, { color: CARD.ink }]} numberOfLines={1} adjustsFontSizeToFit>{t.big}</Text>
              <Text variant="label" color={CARD.soft}>{t.small}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.co2, { backgroundColor: CARD.tile }]}>
          <Text style={[styles.big, { color: CARD.ink }]}>≈ {r.co2Kg.toLocaleString('fr-FR')} kg de CO₂</Text>
          <Text variant="label" color={CARD.soft}>évités, comme {r.carKm} km en voiture (ordre de grandeur)</Text>
        </View>

        {r.topSaved && (
          <Text variant="bodyStrong" color={CARD.ink}>Champion du mois : {r.topSaved.toLowerCase()}</Text>
        )}
        {r.wasted > 0 && (
          <Text variant="label" color={CARD.soft}>
            Jeté : {r.wasted} produit{r.wasted > 1 ? 's' : ''} ({formatEuros(r.wastedValue)}). On fait mieux le mois prochain !
          </Text>
        )}
        <Text variant="label" color={CARD.soft} style={styles.brand}>Gaspalli · l’anti-gaspi à la maison</Text>
      </View>

      {r.saved + r.wasted === 0 ? (
        <Text variant="body" tone="secondary" style={styles.center}>Pas encore d’activité ce mois-ci : glisse tes produits consommés dans l’inventaire, ou finis-les au scan.</Text>
      ) : (
        <Button size="lg" label="Partager le bilan" icon={<Share2 size={20} color={colors.onPrimary} />} onPress={share} />
      )}
      <Text variant="label" tone="secondary" style={styles.center}>
        Montants : prix réels quand tu les as indiqués, sinon estimés par type de produit. CO₂ : moyennes Agribalyse/ADEME par famille d’aliments.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderRadius: 28, padding: 20, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pepin: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.title, fontSize: 30, lineHeight: 34 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', flexGrow: 1, borderRadius: 18, padding: 14, gap: 2 },
  big: { fontFamily: fonts.title, fontSize: 26, lineHeight: 30 },
  co2: { borderRadius: 18, padding: 14, gap: 2 },
  brand: { textAlign: 'center', marginTop: 4, opacity: 0.85 },
});
