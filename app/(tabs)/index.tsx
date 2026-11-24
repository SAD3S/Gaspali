import { router } from 'expo-router';
import { Bell, Package, Refrigerator, Snowflake, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, ProductCard, Screen, Text } from '@/components/ui';
import { demoItems, subtitleOf, type Location } from '@/data/demo';
import { formatHeaderDate } from '@/domain/dates';
import { computeFreshness, urgencyRank } from '@/domain/freshness';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const TILES: { loc: Location; label: string; Icon: LucideIcon }[] = [
  { loc: 'frigo', label: 'Frigo', Icon: Refrigerator },
  { loc: 'congelo', label: 'Congélo', Icon: Snowflake },
  { loc: 'placard', label: 'Placard', Icon: Package },
];

export default function Accueil() {
  const { colors } = useTheme();
  const today = new Date();
  const withF = demoItems.map((i) => ({ item: i, f: computeFreshness(i.expiry, i.dateType, today) }));
  const urgent = withF
    .filter(({ f }) => f.state === 'urgent' || f.state === 'bientot')
    .sort((a, b) => urgencyRank(a.f) - urgencyRank(b.f))
    .slice(0, 3);
  const hasAlerts = withF.some(({ f }) => f.state === 'urgent' || f.state === 'perime');
  const saved = 92;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="label" tone="secondary">{formatHeaderDate(today)}</Text>
          <Text variant="title1" accessibilityRole="header">Bonjour !</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasAlerts ? 'Notifications, nouvelles alertes' : 'Notifications'}
          style={[styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Bell size={22} color={colors.text} />
          {hasAlerts && <View style={[styles.dot, { backgroundColor: colors.urgent, borderColor: colors.surface }]} />}
        </Pressable>
      </View>

      <Card>
        <View style={styles.cardHead}>
          <Text variant="title2" accessibilityRole="header">À consommer vite</Text>
          <Pressable accessibilityRole="link" onPress={() => router.navigate('/inventaire')} hitSlop={12}>
            <Text variant="label" tone="primary" style={styles.bold}>Tout voir</Text>
          </Pressable>
        </View>
        {urgent.map(({ item, f }) => (
          <ProductCard key={item.id} variant="row" name={item.name} initials={item.initials} subtitle={subtitleOf(item)} state={f.state} badgeLabel={f.label} />
        ))}
      </Card>

      <View style={styles.tiles}>
        {TILES.map(({ loc, label, Icon }) => (
          <Pressable
            key={loc}
            accessibilityRole="button"
            accessibilityLabel={`${label} : ${demoItems.filter((i) => i.location === loc).length} produits`}
            onPress={() => router.navigate('/inventaire')}
            style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon size={22} color={colors.primaryText} />
            <Text variant="title2" style={styles.tileCount}>{demoItems.filter((i) => i.location === loc).length}</Text>
            <Text variant="label" tone="secondary">{label}</Text>
          </Pressable>
        ))}
      </View>

      <Card tone="primary" style={{ gap: 6 }}>
        <Text variant="overline" tone="onPrimary" style={{ opacity: 0.85 }}>Idée anti-gaspi</Text>
        <Text variant="title2" tone="onPrimary">Gratin poulet-épinards</Text>
        <Text variant="body" tone="onPrimary">35 min · utilise 3 de tes produits urgents</Text>
        <Button label="Voir la recette" variant="onPrimary" style={styles.recipeBtn} />
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={styles.cardHead}>
          <Text variant="bodyStrong">Ce mois-ci</Text>
          <Text variant="label" tone="secondary">4,80 € jetés</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: saved }}
          style={[styles.track, { backgroundColor: colors.surface2 }]}
        >
          <View style={[styles.fill, { width: `${saved}%`, backgroundColor: colors.primary }]} />
        </View>
        <Text variant="label" tone="secondary">{saved} % de tes produits sauvés</Text>
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
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
