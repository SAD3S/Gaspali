import { StyleSheet, View } from 'react-native';
import { Card, FreshnessBadge, Text } from '@/components/ui';
import type { IngredientCheck, IngredientStatus } from '@/domain/recipeEngine';
import { formatNumber, formatQuantity } from '@/domain/quantity';
import { roundForDisplay } from '@/domain/units';
import { useTheme } from '@/theme/ThemeProvider';
import type { FreshnessState } from '@/theme/tokens';

const STATUS: Record<IngredientStatus, { label: string; state: FreshnessState | null }> = {
  urgent: { label: 'À utiliser vite', state: 'urgent' },
  bientot: { label: 'Périme bientôt', state: 'bientot' },
  a_verifier: { label: 'À vérifier', state: 'a_verifier' },
  dispo: { label: 'Dans ton frigo', state: 'frais' },
  base: { label: 'De base', state: null },
  manquant: { label: 'Manquant', state: null },
};

export function formatRecipeQuantity(q: number | null, unit: string | null): string {
  if (q == null) return '';
  const v = roundForDisplay(q, unit);
  if (!unit || unit === 'pièce') return formatNumber(v);
  return `${formatNumber(v)} ${unit}`;
}

/** Ingrédients d'une recette avec leur disponibilité dans l'inventaire. */
export function IngredientChecks({ checks, ratio = 1 }: { checks: IngredientCheck[]; ratio?: number }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingVertical: 4 }}>
      {checks.map((c, i) => {
        const st = STATUS[c.status];
        const product = c.stock[0];
        return (
          <View key={`${c.label}-${i}`} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={styles.flex}>
              <Text variant="body">
                <Text variant="body" style={styles.bold}>{formatRecipeQuantity(c.ri.quantity != null ? c.ri.quantity * ratio : null, c.ri.unit)}</Text>
                {c.ri.quantity != null ? ' ' : ''}{c.label}{c.ri.optional ? ' (facultatif)' : ''}
              </Text>
              {product && c.status !== 'base' && (
                <Text variant="label" tone="secondary" numberOfLines={1}>
                  {product.item.name} · {formatQuantity(product.item.quantity, product.item.unit)} · {product.freshness.label}
                </Text>
              )}
            </View>
            {st.state ? (
              <FreshnessBadge state={st.state} label={st.label} />
            ) : (
              <Text variant="label" tone={c.status === 'manquant' && !c.ri.optional ? 'urgent' : 'secondary'} style={styles.bold}>
                {c.ri.optional && c.status === 'manquant' ? 'Facultatif' : st.label}
              </Text>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6 },
  bold: { fontFamily: 'DMSans_700Bold' },
});
