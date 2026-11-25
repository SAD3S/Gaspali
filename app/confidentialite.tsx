import { router } from 'expo-router';
import { ChevronLeft, Download, ExternalLink, ShieldCheck, Trash2, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Screen, Text, useSnackbar } from '@/components/ui';
import { CONTACT_EMAIL, PRIVACY_URL } from '@/config';
import { privacySections, PRIVACY_UPDATED } from '@/data/privacy';
import { wipeLocalData } from '@/db/reset';
import { useAuth } from '@/features/account/AuthProvider';
import { exportData, importData } from '@/services/dataExport';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Confirmation (Alert sur téléphone, confirm() sur le web). */
function confirmAction(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Confidentialité : tes données (export, import, effacement) et la politique complète. */
export default function Confidentialite() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const auth = useAuth();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const run = async (kind: 'export' | 'import') => {
    setBusy(kind);
    try {
      if (kind === 'export') await exportData();
      else {
        const res = await importData();
        if (res) snackbar.show(res.imported ? `${res.imported} élément${res.imported > 1 ? 's' : ''} restauré${res.imported > 1 ? 's' : ''}` : 'Tout était déjà là');
      }
    } catch (e) {
      snackbar.show(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={styles.flex} numberOfLines={1}>Confidentialité</Text>
      </View>

      <Card style={{ gap: 10 }}>
        <View style={styles.row}>
          <ShieldCheck size={24} color={colors.primaryText} />
          <Text variant="bodyStrong" style={styles.flex}>Tes données</Text>
        </View>
        <Text variant="body" tone="secondary">
          Télécharge une copie complète (fichier JSON), restaure une sauvegarde, ou efface tout.
        </Text>
        <Button label="Exporter mes données" icon={<Download size={18} color={colors.onPrimary} />} disabled={!!busy} onPress={() => void run('export')} />
        <Button label="Restaurer une sauvegarde" variant="soft" icon={<Upload size={18} color={colors.primaryText} />} disabled={!!busy} onPress={() => void run('import')} />
        {auth.session ? (
          <Button label="Supprimer mon compte" variant="outline" icon={<Trash2 size={18} color={colors.text} />} onPress={() => router.push('/compte/supprimer')} />
        ) : (
          <Button
            label="Effacer mes données"
            accessibilityHint="Efface toutes les données Gaspalli de ce téléphone"
            variant="outline"
            icon={<Trash2 size={18} color={colors.text} />}
            onPress={() =>
              confirmAction(
                'Tout effacer ?',
                'Inventaire, historique, recettes perso, courses, planning et réglages seront supprimés de ce téléphone. Exporte-les d’abord si tu veux les garder.',
                'Tout effacer',
                () => {
                  void wipeLocalData().then(() => {
                    snackbar.show('Données effacées');
                    router.replace('/bienvenue');
                  });
                },
              )
            }
          />
        )}
      </Card>

      {privacySections(CONTACT_EMAIL).map((s) => (
        <View key={s.title} style={{ gap: 6 }}>
          <Text variant="bodyStrong" accessibilityRole="header">{s.title}</Text>
          {s.items.map((item) => (
            <View key={item} style={s.bullets ? styles.bullet : undefined}>
              {s.bullets && <Text variant="body" tone="secondary">•</Text>}
              <Text variant="body" tone="secondary" style={styles.flex}>{item}</Text>
            </View>
          ))}
        </View>
      ))}

      {PRIVACY_URL && (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL!)} style={styles.link}>
          <ExternalLink size={16} color={colors.primaryText} />
          <Text variant="label" tone="primary" style={styles.bold}>Version en ligne</Text>
        </Pressable>
      )}
      <Text variant="label" tone="secondary">Mise à jour : {PRIVACY_UPDATED}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: 'DMSans_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: { flexDirection: 'row', gap: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH },
});
