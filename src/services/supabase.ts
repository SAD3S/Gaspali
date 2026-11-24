import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Client Supabase, ou null si le projet n'est pas configuré : l'app fonctionne alors 100 % en local.
 * Variables (inlinées au build par Expo) : EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * La clé « anon » est publique par nature : la sécurité repose sur la RLS côté serveur.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : null;

export const cloudEnabled = supabase !== null;

// Rafraîchissement du jeton uniquement quand l'app est au premier plan (recommandation Supabase).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Message d'erreur lisible en français. */
export function frenchError(e: unknown): string {
  const err = e as { message?: string; code?: string; status?: number } | null;
  const msg = err?.message ?? String(e);
  if (/network request failed|failed to fetch|fetch failed|networkerror/i.test(msg)) return 'Pas de connexion internet.';
  if (/token has expired|invalid.*(otp|token)|otp.*(expired|invalid)/i.test(msg)) return 'Code incorrect ou expiré.';
  if (/rate limit|too many/i.test(msg)) return 'Trop de tentatives : réessaie dans quelques minutes.';
  if (err?.code === 'P0002' || /code d'invitation inconnu/i.test(msg)) return 'Ce code d’invitation n’existe pas (ou a été renouvelé).';
  if (err?.code === '42501' || /réservé aux administrateurs/i.test(msg)) return 'Action réservée aux administrateurs du foyer.';
  if (/invalid email|email.*invalid/i.test(msg)) return 'Adresse e-mail invalide.';
  return msg;
}

export function isNetworkError(e: unknown): boolean {
  return frenchError(e) === 'Pas de connexion internet.';
}
