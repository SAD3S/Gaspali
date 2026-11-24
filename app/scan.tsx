import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Keyboard, Leaf, X, Zap, ZapOff } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, useSnackbar } from '@/components/ui';
import { addItem } from '@/db/inventoryRepo';
import { lookupBarcode, saveManualProduct } from '@/db/productsRepo';
import { normalizeBarcode } from '@/domain/barcode';
import { getCategory, LOCATION_LABELS, type CategoryId, type Location } from '@/domain/categories';
import { parsePackageDates, type DateCandidate } from '@/domain/dateOcr';
import { defaultExpiry } from '@/domain/inventory';
import type { ItemFormValue } from '@/features/inventory/ItemForm';
import { ConfirmSheet, type SheetProduct } from '@/features/scan/ConfirmSheet';
import { DateResultSheet } from '@/features/scan/DateResultSheet';
import { ManualCodeSheet } from '@/features/scan/ManualCodeSheet';
import { ocrAvailable, recognizeText } from '@/services/textRecognition';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

type Mode = 'scanning' | 'loading' | 'confirm' | 'date' | 'reading';

const SCAN_GREEN = '#4CC38A';
const ON_DARK = '#FFFFFF';
const GLASS = 'rgba(255,255,255,0.14)';
/** Délai avant d'accepter à nouveau le même code (le produit est souvent encore devant la caméra). */
const SAME_CODE_COOLDOWN = 3000;

function initialForm(category: CategoryId): ItemFormValue {
  const c = getCategory(category);
  return { dateType: c.dateType, expiresAt: defaultExpiry(category, c.location), quantity: 1, unit: 'pièce', location: c.location };
}

/** Écran « Ajout après scan » : caméra + feuille de confirmation, mode rafale. */
export default function Scan() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [mode, setMode] = useState<Mode>('scanning');
  const [burst, setBurst] = useState(true);
  const [added, setAdded] = useState(0);
  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const [target, setTarget] = useState<SheetProduct | null>(null);
  const [form, setForm] = useState<ItemFormValue>(() => initialForm('autre'));
  const [dateTouched, setDateTouched] = useState(false);
  const [unknownName, setUnknownName] = useState('');
  const [unknownCategory, setUnknownCategory] = useState<CategoryId>('autre');
  const [candidates, setCandidates] = useState<DateCandidate[] | null>(null);

  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const busy = useRef(false);

  const currentCategory: CategoryId = target?.kind === 'found' ? target.product.category : unknownCategory;

  const handleCode = useCallback(async (raw: string) => {
    const code = normalizeBarcode(raw);
    if (!code || busy.current) return;
    const last = lastCode.current;
    if (last && last.code === code && Date.now() - last.at < SAME_CODE_COOLDOWN) return;
    busy.current = true;
    lastCode.current = { code, at: Date.now() };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode('loading');
    try {
      const r = await lookupBarcode(code);
      if (r.status === 'found') {
        setTarget({ kind: 'found', product: r.product, source: r.source });
        setForm(initialForm(r.product.category));
      } else {
        setTarget({ kind: 'unknown', barcode: code, offline: r.offline });
        setUnknownName('');
        setUnknownCategory('autre');
        setForm(initialForm('autre'));
      }
      setDateTouched(false);
      setMode('confirm');
    } finally {
      busy.current = false;
    }
  }, []);

  const onBarcodeScanned = useCallback((e: BarcodeScanningResult) => void handleCode(e.data), [handleCode]);

  const reset = () => {
    setTarget(null);
    setMode('scanning');
    // Le même produit reste souvent dans le champ : on repart du cooldown.
    if (lastCode.current) lastCode.current.at = Date.now();
  };

  const add = () => {
    if (!target) return;
    let productId: string | null = null;
    let product = target.kind === 'found' ? target.product : null;
    if (target.kind === 'unknown') {
      const saved = saveManualProduct(target.barcode, unknownName, unknownCategory);
      productId = saved.id;
      product = saved.product;
    }
    if (!product) return;
    addItem({
      name: product.name,
      category: product.category,
      brand: product.brand,
      imageUrl: product.imageUrl,
      productId,
      // Quantité = nombre d'exemplaires × contenance (« 2 × 20 cl » → 40 cl).
      quantity: form.quantity * product.packQuantity,
      unit: product.packUnit,
      location: form.location,
      dateType: form.dateType,
      expiresAt: form.expiresAt,
      expiryEstimated: !dateTouched,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAdded((n) => n + 1);
    snackbar.show(`Ajouté au ${LOCATION_LABELS[form.location].toLowerCase()} : ${product.name}`, undefined, 'top');
    if (burst) reset();
    else router.back();
  };

  const onFormChange = (v: ItemFormValue) => {
    if (v.expiresAt.getTime() !== form.expiresAt.getTime() || v.dateType !== form.dateType) setDateTouched(true);
    setForm(v);
  };

  const onLocationChange = (location: Location) =>
    setForm((f) => ({ ...f, location, ...(dateTouched ? {} : { expiresAt: defaultExpiry(currentCategory, location) }) }));

  const onUnknownCategory = (c: CategoryId) => {
    setUnknownCategory(c);
    if (!dateTouched) setForm(initialForm(c));
  };

  const startReadDate = () => {
    if (!ocrAvailable) {
      snackbar.show('La lecture de la date fonctionne dans l’app installée (pas dans Expo Go).', undefined, 'top');
      return;
    }
    setMode('date');
  };

  const captureDate = async () => {
    if (!camera.current) return;
    setMode('reading');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      const text = photo?.uri ? await recognizeText(photo.uri) : '';
      setCandidates(parsePackageDates(text));
    } catch {
      setCandidates([]);
    }
  };

  const confirmDate = (c: DateCandidate) => {
    setForm((f) => ({ ...f, expiresAt: c.date, dateType: c.dateType ?? f.dateType }));
    setDateTouched(true);
    setCandidates(null);
    setMode('confirm');
  };

  const cameraReady = permission?.granted && Platform.OS !== 'web';
  const showSheet = mode === 'confirm' && target;
  const frame = mode === 'date' || mode === 'reading' ? styles.frameDate : styles.frame;

  return (
    <View style={[styles.flex, { backgroundColor: colors.camera }]}>
      {cameraReady && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={mode === 'scanning' ? onBarcodeScanned : undefined}
          accessibilityLabel="Vue caméra"
        />
      )}

      <SafeAreaView edges={['top']} style={[styles.top, showSheet ? null : styles.flex]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => router.back()} style={[styles.round, { backgroundColor: GLASS }]}>
            <X size={22} color={ON_DARK} />
          </Pressable>
          <View style={[styles.burst, { backgroundColor: GLASS }]}>
            <Switch
              value={burst}
              onValueChange={setBurst}
              accessibilityLabel="Mode rafale : enchaîner les scans"
              trackColor={{ true: colors.primary, false: '#555' }}
              thumbColor="#FFFFFF"
              style={{ transform: [{ scale: 0.8 }] }}
            />
            <Text variant="label" color={ON_DARK} style={styles.bold}>
              Mode rafale{burst && added > 0 ? ` · ${added}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: torch }}
            accessibilityLabel="Lampe torche"
            onPress={() => setTorch((t) => !t)}
            style={[styles.round, { backgroundColor: torch ? SCAN_GREEN : GLASS }]}
          >
            {torch ? <Zap size={22} color="#0B1F15" /> : <ZapOff size={22} color={ON_DARK} />}
          </Pressable>
        </View>

        <View style={[styles.frameWrap, !showSheet && styles.flex]} pointerEvents="none">
          <View style={[frame, { borderColor: SCAN_GREEN }]}>
            {mode === 'loading' || mode === 'reading' ? (
              <ActivityIndicator color={SCAN_GREEN} size="large" />
            ) : mode !== 'date' ? (
              <View style={[styles.laser, { backgroundColor: SCAN_GREEN }]} />
            ) : null}
          </View>
          {!showSheet && (
            <Text variant="bodyStrong" color={ON_DARK} style={styles.hint} accessibilityLiveRegion="polite">
              {mode === 'loading'
                ? 'Recherche du produit…'
                : mode === 'date'
                  ? 'Cadre la date imprimée sur l’emballage'
                  : mode === 'reading'
                    ? 'Lecture de la date…'
                    : 'Vise le code-barres'}
            </Text>
          )}
        </View>

        {!showSheet && mode === 'scanning' && (
          <View style={styles.bottomPanel}>
            {!cameraReady && (
              <View style={styles.permission}>
                <Text variant="body" color={ON_DARK} style={styles.center}>
                  {Platform.OS === 'web'
                    ? 'Le scan par caméra est disponible sur téléphone.'
                    : 'Gaspalli a besoin de la caméra pour scanner tes produits et tickets.'}
                </Text>
                {Platform.OS !== 'web' && permission?.canAskAgain !== false && (
                  <Button label="Autoriser la caméra" onPress={requestPermission} />
                )}
              </View>
            )}
            <View style={styles.altRow}>
              <Pressable accessibilityRole="button" onPress={() => setManualOpen(true)} style={[styles.alt, { backgroundColor: GLASS }]}>
                <Keyboard size={18} color={ON_DARK} />
                <Text variant="label" color={ON_DARK} style={styles.bold}>Saisir le code</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/ajout')} style={[styles.alt, { backgroundColor: GLASS }]}>
                <Leaf size={18} color={ON_DARK} />
                <Text variant="label" color={ON_DARK} style={styles.bold}>Sans code-barres</Text>
              </Pressable>
            </View>
          </View>
        )}

        {mode === 'date' && (
          <View style={styles.bottomPanel}>
            <Pressable accessibilityRole="button" accessibilityLabel="Prendre la photo de la date" onPress={captureDate} style={styles.shutter}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setMode('confirm')} style={[styles.alt, { backgroundColor: GLASS }]}>
              <Text variant="label" color={ON_DARK} style={styles.bold}>Annuler</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      {showSheet && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <ConfirmSheet
            target={target}
            form={form}
            onFormChange={onFormChange}
            onLocationChange={onLocationChange}
            onReadDate={startReadDate}
            unknownName={unknownName}
            onUnknownName={setUnknownName}
            unknownCategory={unknownCategory}
            onUnknownCategory={onUnknownCategory}
            burst={burst}
            onAdd={add}
            onCancel={reset}
          />
        </KeyboardAvoidingView>
      )}

      <ManualCodeSheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={(code) => {
          setManualOpen(false);
          lastCode.current = null;
          void handleCode(code);
        }}
      />
      <DateResultSheet
        key={candidates?.map((c) => c.date.getTime()).join('-') ?? 'none'}
        visible={candidates !== null}
        candidates={candidates ?? []}
        onConfirm={confirmDate}
        onRetry={() => {
          setCandidates(null);
          setMode('date');
        }}
        onClose={() => {
          setCandidates(null);
          setMode('confirm');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: 16, paddingBottom: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  burst: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingRight: 14, paddingLeft: 4, minHeight: MIN_TOUCH },
  frameWrap: { alignItems: 'center', justifyContent: 'center', gap: 18, paddingTop: 24 },
  frame: { width: 240, height: 130, borderWidth: 3, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  frameDate: { width: 300, height: 110, borderWidth: 3, borderRadius: 16, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  laser: { width: 180, height: 2 },
  hint: { textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  bottomPanel: { gap: 14, alignItems: 'center', paddingBottom: 16 },
  permission: { gap: 12, alignItems: 'stretch', alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  altRow: { flexDirection: 'row', gap: 10 },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: MIN_TOUCH + 4, borderRadius: 999 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: ON_DARK, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: ON_DARK },
  sheetWrap: { flex: 1 },
  bold: { fontFamily: 'DMSans_700Bold' },
});
