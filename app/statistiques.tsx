import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { ChevronLeft, Table2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from '@/components/ui';
import { eventsSinceQuery } from '@/db/inventoryRepo';
import { getCategory } from '@/domain/categories';
import { formatEuros, monthlyStats, niceTicks, topWastedCategories, type MonthStats } from '@/domain/stats';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, MIN_TOUCH, radius } from '@/theme/tokens';

const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const CHART_HEIGHT = 150;
const BAR_WIDTH = 22;

function monthName(m: MonthStats): string {
  return `${MONTHS_LONG[m.start.getMonth()]}${m.start.getFullYear() !== new Date().getFullYear() ? ` ${m.start.getFullYear()}` : ''}`;
}

/** Statistiques : produits sauvés vs jetés par mois, estimation en €, catégories les plus jetées. */
export default function Statistiques() {
  const { colors } = useTheme();
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const { data } = useLiveQuery(eventsSinceQuery(from), [from.getTime()]);
  const months = useMemo(() => monthlyStats(data ?? [], 6), [data]);
  const top = useMemo(() => topWastedCategories(data ?? [], from), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState(5);
  const [table, setTable] = useState(false);

  const m = months[selected] ?? months[months.length - 1]!;
  const hasData = months.some((x) => x.consumed + x.discarded > 0);
  const ticks = niceTicks(Math.max(...months.map((x) => x.consumed + x.discarded), 1));
  const axisTop = ticks[ticks.length - 1]!;
  const h = (v: number) => (v / axisTop) * CHART_HEIGHT;
  const estimated = (data ?? []).some((e) => (e.type === 'jete' || e.type === 'consomme') && e.value == null);
  const topMax = Math.max(...top.map((t) => t.count), 1);

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={styles.flex}>Statistiques</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!hasData ? (
          <Card style={{ gap: 8 }}>
            <Text variant="bodyStrong">Pas encore de données</Text>
            <Text variant="body" tone="secondary">
              Glisse tes produits vers la droite quand tu les consommes et vers la gauche quand tu les jettes : tes progrès s’afficheront ici, mois par mois.
            </Text>
          </Card>
        ) : (
          <>
            {/* Mois sélectionné : chiffre principal + détails */}
            <Card style={{ gap: 12 }}>
              <Text variant="overline" tone="secondary">{selected === 5 ? 'Ce mois-ci' : monthName(m)}</Text>
              {m.savedPct === null ? (
                <Text variant="body" tone="secondary">Aucun produit consommé ou jeté en {monthName(m)}.</Text>
              ) : (
                <>
                  <View accessible accessibilityLabel={`${m.savedPct} % de tes produits sauvés`}>
                    <Text style={[styles.hero, { color: colors.text }]}>{m.savedPct} %</Text>
                    <Text variant="body" tone="secondary">de tes produits sauvés</Text>
                  </View>
                  <View style={styles.kpis}>
                    <Kpi label="Sauvés" value={String(m.consumed)} swatch={colors.chartSaved} />
                    <Kpi label="Jetés" value={String(m.discarded)} swatch={colors.chartWasted} />
                  </View>
                  <View style={styles.kpis}>
                    <Kpi label="Valeur sauvée" value={`${estimated ? '≈ ' : ''}${formatEuros(m.savedValue)}`} />
                    <Kpi label="Valeur jetée" value={`${m.wastedEstimated ? '≈ ' : ''}${formatEuros(m.wastedValue)}`} />
                  </View>
                </>
              )}
            </Card>

            {/* 6 derniers mois : colonnes empilées sauvés / jetés */}
            <Card style={{ gap: 12 }}>
              <View style={styles.between}>
                <Text variant="bodyStrong" accessibilityRole="header">Sauvés et jetés par mois</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={table ? 'Afficher le graphique' : 'Afficher le tableau'}
                  onPress={() => setTable((t) => !t)}
                  hitSlop={8}
                  style={styles.tableBtn}
                >
                  <Table2 size={18} color={colors.primaryText} />
                  <Text variant="label" tone="primary">{table ? 'Graphique' : 'Tableau'}</Text>
                </Pressable>
              </View>
              <View style={styles.legend}>
                <LegendItem color={colors.chartSaved} label="Sauvés (consommés)" />
                <LegendItem color={colors.chartWasted} label="Jetés" />
              </View>

              {table ? (
                <View>
                  <View style={[styles.tr, { borderBottomColor: colors.border }]}>
                    {['Mois', 'Sauvés', 'Jetés', '%', '€ jetés'].map((h, i) => (
                      <Text key={h} variant="label" tone="secondary" style={i === 0 ? styles.tdFirst : styles.td}>{h}</Text>
                    ))}
                  </View>
                  {months.map((x) => (
                    <View key={x.label} style={[styles.tr, { borderBottomColor: colors.border }]}>
                      <Text variant="body" style={styles.tdFirst}>{x.label}</Text>
                      <Text variant="body" style={[styles.td, styles.num]}>{x.consumed}</Text>
                      <Text variant="body" style={[styles.td, styles.num]}>{x.discarded}</Text>
                      <Text variant="body" style={[styles.td, styles.num]}>{x.savedPct ?? '—'}</Text>
                      <Text variant="body" style={[styles.td, styles.num]}>{x.discarded ? formatEuros(x.wastedValue) : '—'}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.chart}>
                  {/* Axe et grille */}
                  <View style={[styles.axis, { height: CHART_HEIGHT }]}>
                    {ticks.map((t) => (
                      <Text key={t} variant="label" tone="secondary" style={[styles.tick, { bottom: h(t) - 9 }]}>{t}</Text>
                    ))}
                  </View>
                  <View style={styles.flex}>
                    <View style={{ height: CHART_HEIGHT }}>
                      {ticks.map((t) => (
                        <View key={t} style={[styles.grid, { bottom: h(t), backgroundColor: colors.border }]} />
                      ))}
                      <View style={styles.columns}>
                        {months.map((x, i) => {
                          const sel = i === selected;
                          return (
                            <Pressable
                              key={x.label}
                              accessibilityRole="button"
                              accessibilityState={{ selected: sel }}
                              accessibilityLabel={`${monthName(x)} : ${x.consumed} sauvé${x.consumed > 1 ? 's' : ''}, ${x.discarded} jeté${x.discarded > 1 ? 's' : ''}${x.savedPct !== null ? `, ${x.savedPct} %` : ''}`}
                              onPress={() => setSelected(i)}
                              style={[styles.column, sel && { backgroundColor: colors.surface2 }]}
                            >
                              {x.discarded > 0 && (
                                <View style={[styles.bar, styles.barTop, { height: h(x.discarded), backgroundColor: colors.chartWasted, marginBottom: x.consumed > 0 ? 2 : 0 }]} />
                              )}
                              {x.consumed > 0 && (
                                <View style={[styles.bar, x.discarded === 0 && styles.barTop, { height: h(x.consumed), backgroundColor: colors.chartSaved }]} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.labels}>
                      {months.map((x, i) => (
                        <Text key={x.label} variant="label" tone={i === selected ? 'default' : 'secondary'} style={[styles.monthLabel, i === selected && styles.bold]}>
                          {x.label}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              )}
              {!table && <Text variant="label" tone="secondary">Touche un mois pour voir son détail.</Text>}
            </Card>

            {/* Catégories les plus jetées (6 mois) */}
            <Card style={{ gap: 12 }}>
              <Text variant="bodyStrong" accessibilityRole="header">Le plus souvent jeté</Text>
              <Text variant="label" tone="secondary">Sur les 6 derniers mois</Text>
              {top.length === 0 && <Text variant="body" tone="secondary">Rien de jeté sur cette période. Bravo !</Text>}
              {top.map((t) => (
                <View
                  key={t.category}
                  accessible
                  accessibilityLabel={`${getCategory(t.category).label} : ${t.count} produit${t.count > 1 ? 's' : ''} jeté${t.count > 1 ? 's' : ''}, environ ${formatEuros(t.value)}`}
                  style={{ gap: 6 }}
                >
                  <View style={styles.between}>
                    <Text variant="body">{getCategory(t.category).label}</Text>
                    <Text variant="label" tone="secondary">{t.count} · ≈ {formatEuros(t.value)}</Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
                    <View style={[styles.fill, { width: `${(t.count / topMax) * 100}%`, backgroundColor: colors.chartWasted }]} />
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        <Text variant="label" tone="secondary" style={styles.note}>
          Les montants utilisent le prix saisi quand il est connu, sinon un prix moyen par catégorie (≈). Le scan des tickets de caisse donnera les vrais prix.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label} : ${value}`}>
      <View style={styles.kpiHead}>
        {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
        <Text variant="label" tone="secondary">{label}</Text>
      </View>
      <Text variant="title2" style={{ fontFamily: fonts.bodyBold }}>{value}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="label" tone="secondary">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bodyBold },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 4, gap: 14, paddingBottom: 60 },
  hero: { fontFamily: fonts.bodyBold, fontSize: 52, lineHeight: 58 },
  kpis: { flexDirection: 'row', gap: 12 },
  kpi: { flex: 1, gap: 2 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tableBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH },
  legend: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chart: { flexDirection: 'row', gap: 6 },
  axis: { width: 24 },
  tick: { position: 'absolute', right: 0, fontVariant: ['tabular-nums'] },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  columns: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  bar: { width: BAR_WIDTH },
  barTop: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labels: { flexDirection: 'row', marginTop: 6 },
  monthLabel: { flex: 1, textAlign: 'center' },
  tr: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  tdFirst: { flex: 1.2 },
  td: { flex: 1, textAlign: 'right' },
  num: { fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: radius.chip, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.chip },
  note: { textAlign: 'center' },
});
