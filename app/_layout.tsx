import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, Text as RNText, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SnackbarProvider } from '@/components/ui';
import { initDb } from '@/db/client';
import { AuthProvider } from '@/features/account/AuthProvider';
import { SyncManager } from '@/features/account/SyncManager';
import { NotificationManager } from '@/features/notifications/NotificationManager';
import { loadSettings } from '@/features/settings/settings';
import { ShareReceiver } from '@/features/recipes/ShareReceiver';
import { RestockNotifier } from '@/features/shopping/RestockNotifier';
import { initCrashReporting, reportError, wrapRoot } from '@/services/crashReporting';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { palettes } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});
initCrashReporting();

/** Écran affiché si un écran plante : rapport envoyé (si autorisé), et on peut réessayer. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
  useEffect(() => reportError(error), [error]);
  return (
    <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', padding: 28, gap: 14 }}>
      <RNText accessibilityRole="header" style={{ color: c.text, fontSize: 26, fontWeight: '800' }}>Oups, quelque chose s’est mal passé</RNText>
      <RNText style={{ color: c.textSecondary, fontSize: 16, lineHeight: 23 }}>
        Tes données sont en sécurité sur ton téléphone. Réessaie ; si le problème revient, ferme et rouvre l’app.
      </RNText>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{ backgroundColor: c.primary, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
      >
        <RNText style={{ color: c.onPrimary, fontSize: 17, fontWeight: '700' }}>Réessayer</RNText>
      </Pressable>
    </View>
  );
}

function RootStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ajout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="produit/[id]" />
      </Stack>
    </>
  );
}

function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
    Promise.all([initDb(), loadSettings()]).then(() => setDbReady(true), setDbError);
  }, []);

  const ready = (loaded || !!error) && (dbReady || !!dbError);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (dbError) throw dbError; // capturé par l'ErrorBoundary ci-dessus (et envoyé à Sentry)
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <SnackbarProvider>
              <SyncManager />
              <NotificationManager />
              <RestockNotifier />
              <RootStack />
              <ShareReceiver />
            </SnackbarProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
