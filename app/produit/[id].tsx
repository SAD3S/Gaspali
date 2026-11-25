import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Check, ChevronLeft, ChevronRight, PackageOpen, Snowflake, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, Card, FreshnessBadge, ProductAvatar, Stepper, Text, useSnackbar } from '@/components/ui';
import { consumePart, markOpened, moveTo, setStatus, updateItem } from '@/db/inventoryRepo';
import type { EventRow } from '@/db/schema';
import { getCategory, type Location } from '@/domain/categories';
import { formatLongDate, relativeDayLabel, daysBetween } from '@/domain/dates';
import { computeFreshness } from '@/domain/freshness';
import { formatDuration, freezerExtension, remainingOptions } from '@/domain/inventory';
import { formatQuantity, roundQuarter, stepFor } from '@/domain/quantity';
import { roundForDisplay } from '@/domain/units';
import { ItemForm } from '@/features/inventory/ItemForm';
import { finishMessage, itemWorth } from '@/domain/prices';
import { formatEuros } from '@/domain/stats';
import { useItem, useItemHistory } from '@/features/inventory/hooks';
import { useAuthorName } from '@/features/account/hooks';
import { useReservations } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

const EVENT_LABELS: Record<EventRow['type'], string> = {
  ajout: 'Ajouté',
  consomme: 'Consommé',
  jete: 'Jeté',
  entame: 'Entamé',
  partiel: 'En partie consommé',
  modif: 'Modifié',
};

export default function Produit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const item = useItem(id);
  const history = useItemHistory(id);
  const authorName = useAuthorName();
  const reservation = useReservations().get(id);
  const [partialOpen, setPartialOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [freezeAsk, setFreezeAsk] = useState<null | { days: number }>(null);

  if (!item) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background, padding: 20 }]}>
        <Text variant="body">Ce produit n’existe plus.</Text>
        <Button label="Retour" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const f = computeFreshness(item.expiresAt, item.dateType);
  const category = getCategory(item.category);
  const inStock = item.status === 'en_stock';

  const changeLocation = (loc: Location) => {
    if (loc === item.location) return;
    const ext = loc === 'congelo' ? freezerExtension(item) : null;
    if (ext) setFreezeAsk({ days: ext.days });
    else moveTo(item.id, loc, false);
  };

  const worth = itemWorth(item.row);

  const finish = (status: 'consomme' | 'jete') => {
    const undo = setStatus(item.id, status);
    snackbar.show(finishMessage(item.name, status, item.row), undo);
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ProductAvatar name={item.name} state={f.state} size={64} imageUri={item.row.imageUrl ?? undefined} />
          <View style={styles.flex}>
            <Text variant="title2" accessibilityRole="header">{item.name}</Text>
            <Text variant="body" tone="secondary">
              {[item.row.brand, category.label].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <View style={styles.badges}>
          {inStock ? (
            <FreshnessBadge state={f.state} label={f.label} />
          ) : (
            <FreshnessBadge state={item.status === 'consomme' ? 'frais' : 'perime'} label={item.status === 'consomme' ? 'Consommé' : 'Jeté'} />
          )}
          {item.openedAt && <FreshnessBadge state="bientot" label="Entamé" showDot={false} />}
          {item.row.expiryEstimated && <FreshnessBadge state="a_verifier" label="Date estimée" showDot={false} />}
        </View>
        {inStock && (
          <Text variant="label" tone={f.state === 'urgent' || f.state === 'perime' ? 'urgent' : 'secondary'}>
            {worth.estimated
              ? `Vaut environ ${formatEuros(worth.value)} (estimation : indique le prix payé plus bas)`
              : `Vaut ${formatEuros(worth.value)}${f.state === 'urgent' || f.state === 'perime' ? ' : à ne pas laisser perdre !' : ''}`}
          </Text>
        )}
        {inStock && item.row.expiryEstimated && (
          <View style={styles.estimatedRow}>
            <Text variant="label" tone="secondary" style={styles.flex}>
              Date estimée selon le type de produit. Vérifie-la sur l’emballage.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                updateItem(item.id, { expiryEstimated: false });
                snackbar.show('Date confirmée');
              }}
              style={[styles.confirmDate, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Check size={16} color={colors.primaryText} />
              <Text variant="label" tone="primary" style={{ fontFamily: 'DMSans_700Bold' }}>C’est la bonne date</Text>
            </Pressable>
          </View>
        )}
        {f.state === 'a_verifier' && (
          <Text variant="label" tone="secondary">La date de durabilité minimale est passée : le produit est souvent encore bon. Vérifie l’aspect et l’odeur.</Text>
        )}

        {inStock && reservation && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/planning')}>
            <Card style={styles.reserved}>
              <CalendarDays size={20} color={colors.primaryText} />
              <Text variant="body" style={styles.flex}>
                {reservation.quantity < item.quantity - 0.0001 ? `${formatQuantity(roundForDisplay(reservation.quantity, item.unit), item.unit)} réservé${reservation.quantity > 1 ? 's' : ''}` : 'Réservé'} pour {reservation.meals.join(', ')}
              </Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Card>
          </Pressable>
        )}

        {inStock && (
          <>
            <View style={styles.actions}>
              <Button label="Consommé" icon={<Check size={18} color={colors.onPrimary} />} onPress={() => finish('consomme')} style={styles.flex} />
              <Button label="Jeté" variant="outline" icon={<Trash2 size={18} color={colors.text} />} onPress={() => finish('jete')} style={styles.flex} />
            </View>
            <View style={styles.actions}>
              <Button
                label="J’en ai utilisé une partie"
                variant="soft"
                onPress={() => {
                  setRemaining(roundQuarter(item.quantity / 2) || 0);
                  setPartialOpen(true);
                }}
                style={styles.flex}
              />
              {!item.openedAt && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Marquer comme entamé"
                  onPress={() => {
                    markOpened(item.id);
                    snackbar.show(category.openedDays ? `Entamé : à finir d’ici ${formatDuration(category.openedDays)}` : 'Marqué comme entamé');
                  }}
                  style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <PackageOpen size={20} color={colors.text} />
                </Pressable>
              )}
            </View>

            <Card style={{ gap: 4 }}>
              <ItemForm
                showPrice
                value={{ dateType: item.dateType, expiresAt: item.expiresAt, quantity: item.quantity, unit: item.unit, location: item.location, price: item.row.price }}
                onChange={(v) => updateItem(item.id, { ...v, expiryEstimated: item.row.expiryEstimated && v.expiresAt.getTime() === item.expiresAt.getTime() })}
                onLocationChange={changeLocation}
              />
            </Card>
          </>
        )}

        <Text variant="overline" tone="secondary" style={{ marginTop: 8 }}>Historique</Text>
        <Card style={{ paddingVertical: 6 }}>
          {history.map((e, i) => {
            const days = daysBetween(new Date(), e.createdAt);
            return (
              <View key={e.id} style={[styles.histRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Text variant="body" style={styles.flex}>
                  {EVENT_LABELS[e.type]}
                  {e.quantity != null && e.type !== 'ajout' ? ` · ${formatQuantity(e.quantity, e.unit ?? '')}` : ''}
                  {authorName(e.authorId) ? ` par ${authorName(e.authorId)}` : ''}
                </Text>
                <Text variant="label" tone="secondary">{days === 0 ? 'Aujourd’hui' : relativeDayLabel(days)}</Text>
              </View>
            );
          })}
        </Card>
        <Text variant="label" tone="secondary">Ajouté le {formatLongDate(item.addedAt)}</Text>
      </ScrollView>

      <BottomSheet visible={partialOpen} onClose={() => setPartialOpen(false)}>
        <View style={{ gap: 16 }}>
          <Text variant="title2">Il en reste combien ?</Text>
          <View style={styles.wrap}>
            {remainingOptions(item.quantity).map((o) => (
              <Button key={o.label} label={o.label} variant={remaining === roundQuarter(o.value) ? 'primary' : 'outline'} onPress={() => setRemaining(roundQuarter(o.value))} />
            ))}
          </View>
          <View style={styles.between}>
            <Text variant="bodyStrong">Reste</Text>
            <Stepper
              label="quantité restante"
              value={remaining}
              min={0}
              step={item.quantity <= 1 ? 0.25 : stepFor(item.unit)}
              format={(q) => formatQuantity(q, item.unit)}
              onChange={(q) => setRemaining(Math.min(item.quantity, q))}
            />
          </View>
          <Button
            size="lg"
            label={remaining === 0 ? 'Tout est consommé' : 'Valider'}
            onPress={() => {
              const undo = consumePart(item.id, remaining);
              setPartialOpen(false);
              snackbar.show(remaining === 0 ? `${item.name} : consommé` : `Il reste ${formatQuantity(remaining, item.unit)}`, undo);
              if (remaining === 0) router.back();
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!freezeAsk} onClose={() => setFreezeAsk(null)}>
        <View style={{ gap: 14 }}>
          <Snowflake size={28} color={colors.primaryText} />
          <Text variant="title2">Prolonger la date ?</Text>
          <Text variant="body" tone="secondary">
            Au congélateur, ce produit ({category.label.toLowerCase()}) se garde environ {formatDuration(freezeAsk?.days ?? 0)}.
          </Text>
          <Button label={`Oui, ${formatDuration(freezeAsk?.days ?? 0)}`} onPress={() => { moveTo(item.id, 'congelo', true); setFreezeAsk(null); }} />
          <Button label="Non, garder la date" variant="outline" onPress={() => { moveTo(item.id, 'congelo', false); setFreezeAsk(null); }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  estimatedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirmDate: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 40 },
  reserved: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  flex: { flex: 1 },
  top: { paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 4, gap: 14, paddingBottom: 60 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  histRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
