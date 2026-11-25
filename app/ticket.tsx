import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Check, Image as ImageIcon, TriangleAlert, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, FreshnessBadge, Text, useSnackbar } from '@/components/ui';
import { addItem } from '@/db/inventoryRepo';
import { learnAlias, loadAliases, loadKnownProducts } from '@/db/receiptRepo';
import { removeBought } from '@/db/shoppingRepo';
import { LOCATION_LABELS } from '@/domain/categories';
import { formatLongDate } from '@/domain/dates';
import { formatQuantity } from '@/domain/quantity';
import { groupRows, parseReceipt, rowsFromText } from '@/domain/receipt';
import { ingredientOfName } from '@/domain/receiptMatch';
import { buildReview, reviewSummary, shortDate, type ReviewLine } from '@/domain/receiptReview';
import { formatEuros } from '@/domain/stats';
import { LineSheet } from '@/features/receipt/LineSheet';
import { takePendingReceiptText } from '@/features/receipt/pendingText';
import { pickReceiptPhoto, pickReceiptPhotos } from '@/services/photos';
import { ocrAvailable, receiptOcrAvailable, recognizeLines, recognizeText } from '@/services/textRecognition';
import { EmptyState } from '@/components/brand/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

type Phase = 'lecture' | 'revue' | 'vide' | 'saisie';

/** Lecture d'une photo de ticket : lignes positionnées si possible, sinon texte brut. */
async function readReceiptPhoto(uri: string): Promise<string[] | null> {
  if (receiptOcrAvailable) return groupRows(await recognizeLines(uri));
  if (ocrAvailable) return rowsFromText(await recognizeText(uri));
  return null;
}

/** Scan du ticket de caisse : revue des lignes reconnues, puis ajout à l'inventaire. */
export default function Ticket() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { photo, photos, mode } = useLocalSearchParams<{ photo?: string; photos?: string; mode?: string }>();
  // Une ou plusieurs images (tickets, captures de commande drive), ou un texte partagé vers Gaspalli.
  const [initialPhotos] = useState<string[]>(() => {
    if (photo) return [photo];
    try {
      const list = photos ? (JSON.parse(photos) as unknown) : [];
      return Array.isArray(list) ? list.filter((u): u is string => typeof u === 'string') : [];
    } catch {
      return [];
    }
  });
  const [phase, setPhase] = useState<Phase>(initialPhotos.length || mode === 'partage' ? 'lecture' : 'saisie');
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [meta, setMeta] = useState<{ store: string | null; date: Date | null; total: number | null }>({ store: null, date: null, total: null });
  const [editing, setEditing] = useState<ReviewLine | null>(null);
  const [text, setText] = useState('');
  const parts = useRef(0);
  const count = useRef(0);

  /** Ajoute les lignes d'une partie du ticket (un long ticket se prend en plusieurs photos). */
  const analyse = useCallback((rows: string[]): number => {
    const parsed = parseReceipt(rows);
    const added = buildReview(parsed, { aliases: loadAliases(), products: loadKnownProducts() }, parts.current++);
    count.current += added.length;
    setLines((prev) => [...prev, ...added]);
    // Plusieurs tickets : les totaux s'additionnent (la suite d'un long ticket n'a pas de total).
    setMeta((m) => ({
      store: m.store && parsed.store && m.store !== parsed.store ? `${m.store}, ${parsed.store}` : m.store ?? parsed.store,
      date: m.date ?? parsed.date,
      total: parsed.total !== null ? Math.round(((m.total ?? 0) + parsed.total) * 100) / 100 : m.total,
    }));
    return added.length;
  }, []);

  /** Lit les images une à une ; chacune devient une partie de la revue. */
  const read = useCallback(
    async (uris: string[]) => {
      setPhase('lecture');
      let unread = 0;
      for (const uri of uris) {
        try {
          const rows = await readReceiptPhoto(uri);
          if (!rows) {
            snackbar.show('La lecture automatique fonctionne dans l’app installée. Tu peux saisir le texte du ticket.', undefined, 'top');
            setPhase(count.current ? 'revue' : 'saisie');
            return;
          }
          if (!analyse(rows)) unread++;
        } catch {
          unread++;
        }
      }
      if (unread && count.current) snackbar.show(`${unread} image${unread > 1 ? 's' : ''} sans article reconnu.`, undefined, 'top');
      setPhase(count.current ? 'revue' : 'vide');
    },
    [analyse, snackbar],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialPhotos.length) void read(initialPhotos);
    else if (mode === 'partage') {
      const text = takePendingReceiptText();
      if (text && analyse(rowsFromText(text))) setPhase('revue');
      else {
        if (text) setText(text);
        setPhase('saisie');
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addNextPart = async () => {
    const uri = await pickReceiptPhoto('camera').catch(() => null);
    if (uri) await read([uri]);
  };

  const addOtherReceipts = async () => {
    const uris = await pickReceiptPhotos().catch(() => [] as string[]);
    if (uris.length) await read(uris);
  };

  const update = (l: ReviewLine) => setLines((prev) => prev.map((x) => (x.id === l.id ? l : x)));

  const save = () => {
    const kept = lines.filter((l) => l.include);
    for (const l of kept) {
      addItem({
        name: l.name,
        category: l.category,
        quantity: l.quantity,
        unit: l.unit,
        location: l.location,
        dateType: l.dateType,
        expiresAt: l.expiresAt,
        expiryEstimated: !l.dateConfirmed,
        price: l.price,
      });
      // Apprentissage : la prochaine fois, ce libellé donnera directement ce produit.
      learnAlias(l.key, { name: l.name, category: l.category, location: l.location, unit: l.unit });
    }
    const removed = removeBought(kept.map((l) => ({ name: l.name, ingredientId: ingredientOfName(l.name) })));
    snackbar.show(
      `${kept.length} produit${kept.length > 1 ? 's' : ''} ajouté${kept.length > 1 ? 's' : ''}` +
        (removed ? ` · ${removed} retiré${removed > 1 ? 's' : ''} de la liste de courses` : ''),
    );
    router.replace('/inventaire');
  };

  const food = lines.filter((l) => !l.nonFood);
  const other = lines.filter((l) => l.nonFood);
  const summary = reviewSummary(lines);
  const readTotal = Math.round(lines.reduce((s, l) => s + (l.price ?? 0), 0) * 100) / 100;
  const mismatch = meta.total !== null && Math.abs(meta.total - readTotal) > 0.05;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <X size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text variant="title2" accessibilityRole="header">Ticket de caisse</Text>
          {(meta.store || meta.date) && (
            <Text variant="label" tone="secondary">{[meta.store, meta.date ? formatLongDate(meta.date) : null].filter(Boolean).join(' · ')}</Text>
          )}
        </View>
      </View>

      {phase === 'lecture' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text variant="bodyStrong" accessibilityLiveRegion="polite">Lecture du ticket…</Text>
          <Text variant="label" tone="secondary">Tout se passe sur ton téléphone.</Text>
        </View>
      )}

      {phase === 'vide' && (
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            mood="oups"
            title="Aucun article reconnu"
            text="Pose le ticket bien à plat, sans pli, avec de la lumière et sans reflet. Pour un long ticket, prends-le en plusieurs fois."
          />
          <Button label="Reprendre la photo" icon={<Camera size={18} color={colors.onPrimary} />} onPress={() => router.replace({ pathname: '/scan', params: { onglet: 'ticket' } })} />
          <Button label="Saisir le texte du ticket" variant="outline" onPress={() => setPhase('saisie')} />
        </ScrollView>
      )}

      {phase === 'saisie' && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="body" tone="secondary">
            {receiptOcrAvailable || ocrAvailable
              ? 'Colle ou tape les lignes du ticket, une par ligne, avec leur prix.'
              : 'La lecture automatique du ticket fonctionne dans l’app installée. Ici, colle ou tape les lignes du ticket, une par ligne, avec leur prix.'}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder={'YAOURT NAT X4     1,85\nBLC POULET X2     6,90\nTOTAL             8,75'}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Texte du ticket"
            style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          <Button
            label="Analyser le ticket"
            disabled={!text.trim()}
            onPress={() => {
              const n = analyse(rowsFromText(text));
              setText('');
              if (n || count.current) setPhase('revue');
              else snackbar.show('Aucun article reconnu : vérifie qu’un prix figure au bout de chaque ligne.', undefined, 'top');
            }}
          />
          {count.current > 0 && <Button label="Revenir à la liste" variant="outline" onPress={() => setPhase('revue')} />}
        </ScrollView>
      )}

      {phase === 'revue' && (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Card style={{ gap: 8 }}>
              <Text variant="bodyStrong">
                {summary.count} produit{summary.count > 1 ? 's' : ''} à ranger · {formatEuros(summary.amount)}
              </Text>
              <View style={styles.estimated}>
                <FreshnessBadge state="a_verifier" label="Date estimée" showDot={false} />
                <Text variant="label" tone="secondary" style={styles.flex}>
                  Le ticket ne donne pas les dates : elles sont estimées selon le type de produit. Touche une ligne pour corriger.
                </Text>
              </View>
              {mismatch && (
                <View style={styles.estimated}>
                  <TriangleAlert size={18} color={colors.urgent} />
                  <Text variant="label" tone="secondary" style={styles.flex}>
                    Total du ticket : {formatEuros(meta.total!)}, lignes lues : {formatEuros(readTotal)}. Une ligne a peut-être été mal lue.
                  </Text>
                </View>
              )}
            </Card>

            {food.length > 0 && <Text variant="overline" tone="secondary" accessibilityRole="header">À ranger</Text>}
            {food.length > 0 && (
              <Card style={{ paddingVertical: 4 }}>
                {food.map((l, i) => (
                  <LineRow key={l.id} line={l} first={i === 0} onToggle={() => update({ ...l, include: !l.include })} onPress={() => setEditing(l)} />
                ))}
              </Card>
            )}
            {other.length > 0 && (
              <>
                <Text variant="overline" tone="secondary" accessibilityRole="header">Pas pour le frigo</Text>
                <Card style={{ paddingVertical: 4 }}>
                  {other.map((l, i) => (
                    <LineRow key={l.id} line={l} first={i === 0} onToggle={() => update({ ...l, include: !l.include })} onPress={() => setEditing(l)} />
                  ))}
                </Card>
              </>
            )}

            <Button label="Ajouter la suite du ticket" variant="outline" icon={<Camera size={18} color={colors.text} />} onPress={addNextPart} />
            <Button label="Ajouter d’autres tickets ou captures" variant="outline" icon={<ImageIcon size={18} color={colors.text} />} onPress={addOtherReceipts} />
            <Button label="Saisir une ligne manquante" variant="outline" onPress={() => setPhase('saisie')} />
          </ScrollView>
          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Button
              size="lg"
              label={summary.count ? `Ajouter ${summary.count} produit${summary.count > 1 ? 's' : ''} à l’inventaire` : 'Aucun produit coché'}
              disabled={!summary.count}
              icon={<Check size={20} color={colors.onPrimary} />}
              onPress={save}
            />
          </View>
        </>
      )}

      <LineSheet
        key={editing?.id ?? 'aucune'}
        line={editing}
        purchased={meta.date}
        onClose={() => setEditing(null)}
        onSave={(l) => {
          update(l);
          setEditing(null);
        }}
      />
    </SafeAreaView>
  );
}

function LineRow({ line: l, first, onToggle, onPress }: { line: ReviewLine; first: boolean; onToggle: () => void; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: l.include }}
        accessibilityLabel={`Ajouter ${l.name}`}
        onPress={onToggle}
        style={styles.check}
      >
        <View style={[styles.box, { borderColor: l.include ? colors.primary : colors.border, backgroundColor: l.include ? colors.primary : 'transparent' }]}>
          {l.include && <Check size={16} color={colors.onPrimary} />}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${l.name}, ${formatQuantity(l.quantity, l.unit)}, ${LOCATION_LABELS[l.location]}, ${l.dateConfirmed ? 'jusqu’au' : 'date estimée'} ${shortDate(l.expiresAt)}${l.price != null ? `, ${formatEuros(l.price)}` : ''}. Modifier`}
        onPress={onPress}
        style={styles.rowBody}
      >
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1} style={!l.include && { color: colors.textSecondary }}>{l.name}</Text>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {formatQuantity(l.quantity, l.unit)} · {LOCATION_LABELS[l.location]} · {l.dateConfirmed ? '' : '≈ '}{shortDate(l.expiresAt)}
            {l.source === 'aucun' ? ' · à vérifier' : ''}
          </Text>
          <Text variant="label" tone="secondary" numberOfLines={1} style={styles.raw}>{l.raw}</Text>
        </View>
        {l.price != null && <Text variant="body" style={styles.price}>{formatEuros(l.price)}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  content: { padding: 20, paddingTop: 4, gap: 12, paddingBottom: 40 },
  estimated: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textArea: { minHeight: 220, borderWidth: 1, borderRadius: radius.tile, padding: 14, fontFamily: 'DMSans_400Regular', fontSize: 15, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  check: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingRight: 4 },
  raw: { fontSize: 11, lineHeight: 14, opacity: 0.8 },
  price: { fontVariant: ['tabular-nums'] },
  bottomBar: { padding: 16, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
