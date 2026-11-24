import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { membersQuery } from '@/sync/outbox';
import { useAuth } from './AuthProvider';

export interface Member {
  userId: string;
  displayName: string;
  role: 'admin' | 'membre';
}

/** Membres du foyer actif (cache local, mis à jour à chaque synchro). */
export function useMembers(): Member[] {
  const { active } = useAuth();
  const { data } = useLiveQuery(membersQuery(active?.id ?? '—'), [active?.id]);
  return useMemo(() => (data ?? []).map((m) => ({ userId: m.userId, displayName: m.displayName, role: m.role })), [data]);
}

/** « par Léa », « par toi », ou rien si l'auteur est inconnu. */
export function useAuthorName(): (userId: string | null | undefined) => string | null {
  const { session } = useAuth();
  const members = useMembers();
  return useMemo(() => {
    const byId = new Map(members.map((m) => [m.userId, m.displayName]));
    return (userId) => {
      if (!userId) return null;
      if (userId === session?.user.id) return 'toi';
      return byId.get(userId) || null;
    };
  }, [members, session?.user.id]);
}
