import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, Text } from '@/components/ui';
import { GOOGLE_SIGN_IN } from '@/config';
import { useAuth } from '@/features/account/AuthProvider';
import { frenchError } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_DELAY = 60;

/** Connexion sans mot de passe : lien (ou code à 6 chiffres) par e-mail, Google, ou Apple (iOS). */
export default function Connexion() {
  const { colors, scheme } = useTheme();
  const auth = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const done = () => router.replace((next || '/compte') as Href);

  // Connexion terminée par le lien de l'e-mail (écran auth/callback) pendant que celui-ci est ouvert.
  useEffect(() => {
    if (auth.session && step === 'code') done();
  }, [auth.session]); // eslint-disable-line react-hooks/exhaustive-deps

  const attempt = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(frenchError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    attempt(async () => {
      await auth.sendEmailCode(email);
      setStep('code');
      setCooldown(RESEND_DELAY);
    });

  const verify = (value = code) =>
    attempt(async () => {
      await auth.verifyEmailCode(email, value);
      done();
    });

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => (step === 'code' ? setStep('email') : router.back())}
            style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <ChevronLeft size={22} color={colors.text} />
          </Pressable>
          <Text variant="title1" accessibilityRole="header">Connexion</Text>

          {step === 'email' ? (
            <>
              <Text variant="body" tone="secondary">Pas de mot de passe : on t’envoie un lien de connexion par e-mail.</Text>
              <Field
                label="Adresse e-mail"
                value={email}
                onChangeText={setEmail}
                placeholder="prenom@exemple.fr"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={() => EMAIL_RE.test(email.trim()) && void sendCode()}
                error={error}
              />
              <Button label="Recevoir le lien" onPress={sendCode} disabled={busy || !EMAIL_RE.test(email.trim())} />
            </>
          ) : (
            <>
              <Text variant="body" tone="secondary">
                E-mail envoyé à <Text variant="body" style={styles.bold}>{email.trim()}</Text>. Ouvre-le sur ce téléphone et touche le
                lien : l’app s’ouvre et te connecte. Pense à regarder dans les spams.
              </Text>
              <Field
                label="Ou saisis le code, si l’e-mail en contient un"
                value={code}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, '').slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6) void verify(digits);
                }}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                style={styles.codeInput}
                error={error}
              />
              {code.length > 0 && <Button label="Valider le code" onPress={() => verify()} disabled={busy || code.length !== 6} />}
              <Button
                label={cooldown > 0 ? `Renvoyer l’e-mail (${cooldown} s)` : 'Renvoyer l’e-mail'}
                variant="outline"
                onPress={sendCode}
                disabled={busy || cooldown > 0}
              />
            </>
          )}

          {(GOOGLE_SIGN_IN || appleAvailable) && (
            <View style={styles.or}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <Text variant="label" tone="secondary">ou</Text>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>
          )}

          {GOOGLE_SIGN_IN && (
            <Button
              label="Continuer avec Google"
              variant="outline"
              disabled={busy}
              onPress={() =>
                attempt(async () => {
                  if (await auth.signInWithGoogle()) done();
                })
              }
            />
          )}
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={styles.apple}
              onPress={() =>
                attempt(async () => {
                  if (await auth.signInWithApple()) done();
                })
              }
            />
          )}
          <Text variant="label" tone="secondary" style={styles.center}>
            En continuant, tu acceptes que ton prénom soit visible par les membres de ton foyer.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bold: { fontFamily: 'DMSans_700Bold' },
  codeInput: { fontSize: 28, letterSpacing: 10, textAlign: 'center', fontFamily: 'DMSans_700Bold' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  apple: { height: 52 },
  center: { textAlign: 'center' },
});
