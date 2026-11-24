import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ChevronLeft, CloudOff, RefreshCw, Share2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { Button, Card, Field, ProductAvatar, Screen, Text, useSnackbar } from '@/components/ui';
import { formatInviteCode, isValidInviteCode, normalizeInviteCode } from '@/domain/sync';
import { useAuth, type Household } from '@/features/account/AuthProvider';
import { useMembers } from '@/features/account/hooks';
import { frenchError } from '@/services/supabase';
import { syncNow, useSyncStatus } from '@/sync/engine';
import { countLocalOnly } from '@/sync/outbox';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

function BackHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ChevronLeft size={22} color={colors.text} />
      </Pressable>
      <Text variant="title1" accessibilityRole="header" style={styles.flex} numberOfLines={1}>{title}</Text>
    </View>
  );
}

/** « Compte et foyer » : connexion, création / rejoindre un foyer, membres, invitation, synchro. */
export default function Compte() {
  const auth = useAuth();
  if (!auth.cloud) return <LocalOnly />;
  if (!auth.ready) return <Screen><BackHeader title="Compte et foyer" /></Screen>;
  if (!auth.session) return <SignedOut />;
  if (!auth.active) return <NoHousehold />;
  return <HouseholdView household={auth.active} />;
}

function LocalOnly() {
  const { colors } = useTheme();
  return (
    <Screen>
      <BackHeader title="Compte et foyer" />
      <Card style={{ gap: 10 }}>
        <CloudOff size={28} color={colors.textSecondary} />
        <Text variant="bodyStrong">Mode local</Text>
        <Text variant="body" tone="secondary">
          Tes produits restent sur ce téléphone. Le partage en foyer (frigo commun, courses partagées) sera disponible dès que le
          serveur de l’app sera configuré.
        </Text>
      </Card>
    </Screen>
  );
}

function SignedOut() {
  const { colors } = useTheme();
  const local = countLocalOnly();
  return (
    <Screen>
      <BackHeader title="Compte et foyer" />
      <Card style={{ gap: 12 }}>
        <View style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
          <Users size={30} color={colors.primaryText} />
        </View>
        <Text variant="title2">Partage ton frigo</Text>
        <Text variant="body" tone="secondary">
          Crée un foyer et invite les personnes avec qui tu vis : inventaire, courses et repas partagés en temps réel.
        </Text>
        {local > 0 && (
          <Text variant="label" tone="secondary">Tes {local} produits déjà saisis seront ajoutés à ton foyer.</Text>
        )}
        <Button label="Se connecter ou créer un compte" onPress={() => router.push('/compte/connexion')} />
      </Card>
      <Text variant="label" tone="secondary" style={styles.center}>Sans compte, l’app reste utilisable sur ce téléphone.</Text>
    </Screen>
  );
}

function NoHousehold() {
  const auth = useAuth();
  const snackbar = useSnackbar();
  const [name, setName] = useState(auth.displayName);
  const [householdName, setHouseholdName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const local = countLocalOnly();

  const run = async (kind: 'create' | 'join') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'create') {
        const { adopted } = await auth.createHousehold(householdName.trim() || `Chez ${name.trim() || 'moi'}`, name);
        snackbar.show(adopted ? `Foyer créé — ${adopted} éléments partagés` : 'Foyer créé');
      } else {
        const { household } = await auth.joinHousehold(code, name);
        snackbar.show(`Bienvenue dans « ${household.name} »`);
      }
    } catch (e) {
      setError(frenchError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <BackHeader title="Ton foyer" />
      <Field label="Ton prénom" value={name} onChangeText={setName} placeholder="Léa" autoCapitalize="words" maxLength={40} hint="Affiché aux autres membres : « ajouté par Léa »." />

      <Card style={{ gap: 12 }}>
        <Text variant="title2">Créer un foyer</Text>
        <Field label="Nom du foyer" value={householdName} onChangeText={setHouseholdName} placeholder={`Chez ${name.trim() || 'nous'}`} maxLength={60} />
        {local > 0 && <Text variant="label" tone="secondary">Tes {local} produits déjà saisis y seront ajoutés.</Text>}
        <Button label="Créer le foyer" onPress={() => run('create')} disabled={!!busy || !name.trim()} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text variant="title2">Rejoindre un foyer</Text>
        <Field
          label="Code d’invitation"
          value={code}
          onChangeText={setCode}
          placeholder="ABCD 2345"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={11}
          hint="Demande-le à un membre du foyer (Plus › Compte et foyer)."
        />
        <Button
          label="Rejoindre"
          variant="soft"
          onPress={() => run('join')}
          disabled={!!busy || !name.trim() || !isValidInviteCode(normalizeInviteCode(code))}
        />
      </Card>
      {error && <Text variant="label" tone="urgent" accessibilityLiveRegion="polite">{error}</Text>}
      <SignOutButton />
    </Screen>
  );
}

function SyncCard() {
  const { colors } = useTheme();
  const status = useSyncStatus();
  const time = status.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;
  const line =
    status.phase === 'syncing'
      ? 'Synchronisation…'
      : status.phase === 'offline'
        ? `Hors ligne${status.pending ? ` · ${status.pending} modification${status.pending > 1 ? 's' : ''} en attente` : ''}`
        : status.phase === 'error'
          ? `Erreur : ${status.error}`
          : time
            ? `À jour (${time})${status.pending ? ` · ${status.pending} en attente` : ''}`
            : 'Pas encore synchronisé';
  return (
    <Card style={styles.syncCard}>
      <View style={styles.flex}>
        <Text variant="bodyStrong">Synchronisation</Text>
        <Text variant="label" tone={status.phase === 'error' ? 'urgent' : 'secondary'} accessibilityLiveRegion="polite">{line}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Synchroniser maintenant"
        disabled={status.phase === 'syncing'}
        onPress={() => void syncNow()}
        style={[styles.round, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}
      >
        <RefreshCw size={20} color={colors.primaryText} />
      </Pressable>
    </Card>
  );
}

function HouseholdView({ household }: { household: Household }) {
  const auth = useAuth();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const members = useMembers();
  const me = auth.session?.user.id;
  const isAdmin = household.role === 'admin';
  const [name, setName] = useState(auth.displayName);

  const share = () => {
    const link = Linking.createURL(`rejoindre/${household.inviteCode}`);
    void Share.share({
      message:
        `Rejoins notre foyer « ${household.name} » sur Gaspalli pour partager le frigo et les courses.\n\n` +
        `Code : ${formatInviteCode(household.inviteCode)}\nLien : ${link}`,
    });
  };

  const confirm = (title: string, message: string, action: string, run: () => Promise<void>) =>
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: action, style: 'destructive', onPress: () => run().catch((e) => snackbar.show(frenchError(e))) },
    ]);

  return (
    <Screen>
      <BackHeader title={household.name} />

      <Card style={{ gap: 12 }}>
        <Text variant="overline" tone="secondary">Inviter quelqu’un</Text>
        <Text variant="title1" style={styles.code} selectable accessibilityLabel={`Code d’invitation : ${household.inviteCode.split('').join(' ')}`}>
          {formatInviteCode(household.inviteCode)}
        </Text>
        <Button label="Partager l’invitation" icon={<Share2 size={18} color={colors.onPrimary} />} onPress={share} />
        {isAdmin && (
          <Button
            label="Générer un nouveau code"
            variant="outline"
            onPress={() =>
              confirm('Nouveau code ?', 'L’ancien code ne fonctionnera plus. Les membres actuels restent dans le foyer.', 'Générer', async () => {
                await auth.regenerateCode(household.id);
                snackbar.show('Nouveau code généré');
              })
            }
          />
        )}
      </Card>

      <SyncCard />

      <Text variant="overline" tone="secondary">Membres ({members.length})</Text>
      <Card style={{ paddingVertical: 6 }}>
        {members.map((m, i) => (
          <View key={m.userId} style={[styles.member, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <ProductAvatar name={m.displayName || '?'} state="frais" size={40} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{m.displayName || 'Sans nom'}{m.userId === me ? ' (toi)' : ''}</Text>
              <Text variant="label" tone="secondary">{m.role === 'admin' ? 'Administrateur' : 'Membre'}</Text>
            </View>
            {isAdmin && m.userId !== me && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${m.displayName} du foyer`}
                onPress={() =>
                  confirm('Retirer ce membre ?', `${m.displayName || 'Ce membre'} n’aura plus accès au foyer.`, 'Retirer', () =>
                    auth.removeMember(household.id, m.userId),
                  )
                }
                style={styles.textBtn}
              >
                <Text variant="label" tone="urgent">Retirer</Text>
              </Pressable>
            )}
          </View>
        ))}
        {members.length === 0 && (
          <Text variant="label" tone="secondary" style={{ paddingVertical: 12 }}>La liste apparaît après la première synchronisation.</Text>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Field label="Ton prénom" value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />
        {name.trim() !== auth.displayName && name.trim().length > 0 && (
          <Button
            label="Enregistrer"
            variant="soft"
            onPress={() => auth.setDisplayName(name).then(() => snackbar.show('Prénom enregistré'), (e) => snackbar.show(frenchError(e)))}
          />
        )}
      </Card>

      {auth.households.length > 1 && (
        <>
          <Text variant="overline" tone="secondary">Tes autres foyers</Text>
          {auth.households.filter((h) => h.id !== household.id).map((h) => (
            <Button
              key={h.id}
              label={`Passer à « ${h.name} »`}
              variant="outline"
              onPress={() =>
                Alert.alert('Changer de foyer ?', 'Ce téléphone affichera les données de l’autre foyer.', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Changer', onPress: () => void auth.activate(h.id) },
                ])
              }
            />
          ))}
        </>
      )}

      <Button
        label="Quitter le foyer"
        variant="outline"
        onPress={() =>
          confirm(
            'Quitter le foyer ?',
            members.length <= 1
              ? 'Tu es le dernier membre : le foyer et toutes ses données seront supprimés.'
              : 'Tu n’auras plus accès à l’inventaire partagé. Les autres membres le gardent.',
            'Quitter',
            () => auth.leaveHousehold(household.id),
          )
        }
      />
      <SignOutButton />
    </Screen>
  );
}

function SignOutButton() {
  const auth = useAuth();
  const status = useSyncStatus();
  return (
    <Button
      label="Se déconnecter"
      variant="outline"
      onPress={() =>
        Alert.alert(
          'Se déconnecter ?',
          status.pending > 0
            ? `${status.pending} modification(s) n’ont pas encore été envoyées et seront perdues. Reconnecte-toi au réseau d’abord si possible.`
            : 'Les données du foyer restent dans le cloud et seront retirées de ce téléphone.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Se déconnecter', style: 'destructive', onPress: () => void auth.signOut() },
          ],
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  code: { letterSpacing: 4, textAlign: 'center' },
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  textBtn: { minHeight: MIN_TOUCH, paddingHorizontal: 8, justifyContent: 'center' },
});

