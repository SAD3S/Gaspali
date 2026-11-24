import { router, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Field, Screen, Text, useSnackbar } from '@/components/ui';
import { formatInviteCode, isValidInviteCode, normalizeInviteCode } from '@/domain/sync';
import { useAuth } from '@/features/account/AuthProvider';
import { frenchError } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';

/** Lien d'invitation : gaspalli://rejoindre/ABCD2345 */
export default function Rejoindre() {
  const { colors } = useTheme();
  const auth = useAuth();
  const snackbar = useSnackbar();
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(params.code ?? '');
  const [name, setName] = useState(auth.displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const already = auth.households.find((h) => h.inviteCode === code);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const { household } = await auth.joinHousehold(code, name);
      snackbar.show(`Bienvenue dans « ${household.name} »`);
      router.replace('/compte');
    } catch (e) {
      setError(frenchError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card style={{ gap: 12 }}>
        <View style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
          <Users size={30} color={colors.primaryText} />
        </View>
        <Text variant="title2" accessibilityRole="header">Invitation à un foyer</Text>
        <Text variant="title1" style={styles.code}>{formatInviteCode(code)}</Text>

        {!isValidInviteCode(code) ? (
          <Text variant="body" tone="urgent">Ce lien d’invitation n’est pas valide.</Text>
        ) : !auth.cloud ? (
          <Text variant="body" tone="secondary">Le partage n’est pas encore disponible sur cette version de l’app.</Text>
        ) : !auth.session ? (
          <>
            <Text variant="body" tone="secondary">Connecte-toi pour rejoindre ce foyer.</Text>
            <Button label="Se connecter" onPress={() => router.push({ pathname: '/compte/connexion', params: { next: `/rejoindre/${code}` } })} />
          </>
        ) : already ? (
          <>
            <Text variant="body" tone="secondary">Tu fais déjà partie de « {already.name} ».</Text>
            <Button label="Voir le foyer" onPress={() => router.replace('/compte')} />
          </>
        ) : (
          <>
            <Field label="Ton prénom" value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} error={error} />
            <Button label="Rejoindre le foyer" onPress={join} disabled={busy || !name.trim()} />
          </>
        )}
        <Button label="Plus tard" variant="outline" onPress={() => router.replace('/')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  code: { letterSpacing: 4 },
});
