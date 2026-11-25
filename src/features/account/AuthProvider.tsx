import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError, type Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { wipeLocalData } from '@/db/reset';
import { normalizeInviteCode } from '@/domain/sync';
import { supabase } from '@/services/supabase';
import { setSyncContext } from '@/sync/context';
import { scheduleSync, syncNow } from '@/sync/engine';
import { adoptLocalData, purgeHousehold } from '@/sync/outbox';

WebBrowser.maybeCompleteAuthSession();

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  role: 'admin' | 'membre';
}

interface AuthValue {
  /** Supabase configuré (sinon : mode local uniquement). */
  cloud: boolean;
  ready: boolean;
  session: Session | null;
  displayName: string;
  households: Household[];
  active: Household | null;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  /** Retour du lien de connexion reçu par e-mail (gaspalli://auth/callback?code=…). */
  completeEmailLink: (code: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  signInWithApple: () => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Supprime définitivement le compte (serveur) puis toutes les données de ce téléphone. */
  deleteAccount: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  createHousehold: (name: string, displayName: string) => Promise<{ adopted: number }>;
  joinHousehold: (code: string, displayName: string) => Promise<{ household: Household; adopted: number }>;
  activate: (id: string) => Promise<{ adopted: number }>;
  leaveHousehold: (id: string) => Promise<void>;
  regenerateCode: (id: string) => Promise<string>;
  removeMember: (householdId: string, userId: string) => Promise<void>;
  refreshHouseholds: () => Promise<Household[]>;
}

const ACTIVE_KEY = 'gaspalli.household.active';
const CACHE_KEY = 'gaspalli.households';

const AuthContext = createContext<AuthValue | null>(null);

type MemberRow = { role: 'admin' | 'membre'; households: { id: string; name: string; invite_code: string } | null };

function need() {
  if (!supabase) throw new Error('Le partage n’est pas encore configuré sur cette version.');
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setName] = useState('');
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);

  const userId = session?.user.id ?? null;
  const active = households.find((h) => h.id === activeId) ?? null;

  // Le contexte de synchro suit la session et le foyer actif.
  useEffect(() => {
    setSyncContext({ householdId: userId && activeId ? activeId : null, userId });
    activeRef.current = activeId;
    if (userId && activeId) void syncNow();
  }, [userId, activeId]);

  const refreshHouseholds = useCallback(async (): Promise<Household[]> => {
    const sb = need();
    const uid = (await sb.auth.getSession()).data.session?.user.id;
    if (!uid) return [];
    const [{ data, error }, profile] = await Promise.all([
      sb.from('household_members').select('role, households(id, name, invite_code)').eq('user_id', uid),
      sb.from('profiles').select('display_name').eq('id', uid).maybeSingle(),
    ]);
    if (error) throw error;
    const list = ((data ?? []) as unknown as MemberRow[])
      .filter((m) => m.households)
      .map((m) => ({ id: m.households!.id, name: m.households!.name, inviteCode: m.households!.invite_code, role: m.role }));
    setHouseholds(list);
    if (profile.data) setName(profile.data.display_name);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list)).catch(() => {});
    return list;
  }, []);

  /** Rend un foyer actif sur cet appareil (les données d'un autre foyer sont retirées du téléphone). */
  const activate = useCallback(async (id: string) => {
    const prev = activeRef.current;
    if (prev && prev !== id) purgeHousehold(prev);
    const adopted = adoptLocalData(id);
    await AsyncStorage.setItem(ACTIVE_KEY, id).catch(() => {});
    setActiveId(id);
    return { adopted };
  }, []);

  // Démarrage : session enregistrée, foyers en cache (hors ligne), puis rafraîchissement.
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [{ data }, cachedActive, cachedList] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(ACTIVE_KEY).catch(() => null),
        AsyncStorage.getItem(CACHE_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      setSession(data.session);
      if (data.session) {
        if (cachedList) setHouseholds(JSON.parse(cachedList) as Household[]);
        if (cachedActive) setActiveId(cachedActive);
        refreshHouseholds()
          .then((list) => {
            if (cancelled) return;
            // Foyer actif disparu (exclu, supprimé) : on bascule sur un autre ou en local.
            if (cachedActive && !list.some((h) => h.id === cachedActive)) {
              purgeHousehold(cachedActive);
              setActiveId(list[0]?.id ?? null);
              if (list[0]) void activate(list[0].id);
              else AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {});
            } else if (!cachedActive && list[0]) {
              void activate(list[0].id);
            }
          })
          .catch(() => {});
      }
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [refreshHouseholds, activate]);

  // Après une connexion : charger les foyers (et activer le seul foyer s'il n'y en a qu'un).
  const afterSignIn = useCallback(async () => {
    const list = await refreshHouseholds();
    if (!activeRef.current && list.length === 1) await activate(list[0]!.id);
  }, [refreshHouseholds, activate]);

  const value = useMemo<AuthValue>(() => ({
    cloud: !!supabase,
    ready,
    session,
    displayName,
    households,
    active,

    async sendEmailCode(email) {
      // L'e-mail contient un lien (modèle Supabase par défaut) et, si le modèle est personnalisé, un code.
      const { error } = await need().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL('auth/callback') },
      });
      if (error) throw error;
    },

    async verifyEmailCode(email, code) {
      const { error } = await need().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
      await afterSignIn();
    },

    async completeEmailLink(code) {
      const sb = need();
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) {
        // Lien déjà utilisé (ou ouvert deux fois) : si la session existe, tout va bien.
        const { data } = await sb.auth.getSession();
        if (!data.session) throw error;
      }
      await afterSignIn();
    },

    async signInWithGoogle() {
      const sb = need();
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (error) throw error;
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== 'success') return false;
      const code = new URL(res.url).searchParams.get('code');
      if (!code) throw new Error('Connexion Google interrompue.');
      const { error: exErr } = await sb.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
      await afterSignIn();
      return true;
    },

    async signInWithApple() {
      const sb = need();
      if (Platform.OS !== 'ios') return false;
      try {
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        });
        if (!cred.identityToken) throw new Error('Apple n’a pas renvoyé d’identité.');
        const { data, error } = await sb.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
        if (error) throw error;
        // Apple ne donne le nom qu'à la première connexion.
        const given = cred.fullName?.givenName;
        if (given && data.user) await sb.from('profiles').update({ display_name: given }).eq('id', data.user.id);
        await afterSignIn();
        return true;
      } catch (e) {
        if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
        throw e;
      }
    },

    async signOut() {
      const sb = need();
      // Les données du foyer restent dans le cloud ; on les retire de ce téléphone.
      for (const h of households) purgeHousehold(h.id);
      await AsyncStorage.multiRemove([ACTIVE_KEY, CACHE_KEY]).catch(() => {});
      setActiveId(null);
      setHouseholds([]);
      setName('');
      await sb.auth.signOut();
    },

    async deleteAccount() {
      const sb = need();
      const { error } = await sb.functions.invoke('delete-account', { body: {} });
      if (error) {
        let message = 'La suppression a échoué. Vérifie ta connexion et réessaie.';
        if (error instanceof FunctionsHttpError) {
          const body = (await (error.context as Response).json().catch(() => null)) as { message?: string } | null;
          if (body?.message) message = body.message;
        }
        throw new Error(message);
      }
      setActiveId(null);
      setHouseholds([]);
      setName('');
      // Le compte n'existe plus côté serveur : on ferme seulement la session locale.
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
      await wipeLocalData();
    },

    async setDisplayName(name) {
      const sb = need();
      if (!userId) return;
      const { error } = await sb.from('profiles').update({ display_name: name.trim().slice(0, 40) }).eq('id', userId);
      if (error) throw error;
      setName(name.trim());
      scheduleSync(0);
    },

    async createHousehold(name, dn) {
      const { data, error } = await need().rpc('create_household', { p_name: name.trim(), p_display_name: dn.trim() });
      if (error) throw error;
      await refreshHouseholds();
      return activate((data as { id: string }).id);
    },

    async joinHousehold(code, dn) {
      const { data, error } = await need().rpc('join_household', { p_code: normalizeInviteCode(code), p_display_name: dn.trim() });
      if (error) throw error;
      const list = await refreshHouseholds();
      const id = (data as { id: string }).id;
      const { adopted } = await activate(id);
      return { household: list.find((h) => h.id === id)!, adopted };
    },

    activate,

    async leaveHousehold(id) {
      const { error } = await need().rpc('leave_household', { p_household: id });
      if (error) throw error;
      purgeHousehold(id);
      if (activeRef.current === id) {
        setActiveId(null);
        await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {});
      }
      const list = await refreshHouseholds();
      if (activeRef.current === id && list[0]) await activate(list[0].id);
    },

    async regenerateCode(id) {
      const { data, error } = await need().rpc('regenerate_invite_code', { p_household: id });
      if (error) throw error;
      await refreshHouseholds();
      return data as string;
    },

    async removeMember(householdId, uid) {
      const { error } = await need().rpc('remove_member', { p_household: householdId, p_user: uid });
      if (error) throw error;
      scheduleSync(0);
    },

    refreshHouseholds,
  }), [ready, session, displayName, households, active, userId, afterSignIn, refreshHouseholds, activate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
