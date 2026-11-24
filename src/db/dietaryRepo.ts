import { eq, isNull } from 'drizzle-orm';
import type { AllergenId } from '@/data/allergens';
import type { Diet } from '@/domain/recipeEngine';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { stableUuid } from './ids';
import { dietaryProfiles, type DietaryRow } from './schema';

export const LOCAL_USER = 'local';

/** Un profil par personne et par foyer : identifiant déterministe, identique sur tous ses téléphones. */
export function profileId(householdId: string | null, userId: string): string {
  return stableUuid(`${householdId ?? 'local'}:${userId}`);
}

export interface DietaryInput {
  diet: Diet;
  allergens: AllergenId[];
  dislikes: string[];
}

export function parseProfile(r: DietaryRow): DietaryInput & { userId: string } {
  const list = <T,>(s: string): T[] => {
    try {
      return JSON.parse(s) as T[];
    } catch {
      return [];
    }
  };
  return { userId: r.userId, diet: r.diet, allergens: list<AllergenId>(r.allergens), dislikes: list<string>(r.dislikes) };
}

export function profilesQuery() {
  return db.select().from(dietaryProfiles).where(isNull(dietaryProfiles.deletedAt));
}

/** Enregistre MES préférences (pour le foyer actif, ou en local sans compte). */
export function saveMyProfile(input: DietaryInput): void {
  const { householdId, userId } = ownership();
  const uid = householdId && userId ? userId : LOCAL_USER;
  const id = profileId(householdId, uid);
  const now = new Date();
  const fields = {
    diet: input.diet,
    allergens: JSON.stringify([...new Set(input.allergens)]),
    dislikes: JSON.stringify([...new Set(input.dislikes)]),
    updatedAt: now,
  };
  if (db.select().from(dietaryProfiles).where(eq(dietaryProfiles.id, id)).get()) {
    db.update(dietaryProfiles).set({ ...fields, deletedAt: null }).where(eq(dietaryProfiles.id, id)).run();
    trackPatch('dietary_profiles', id, { ...fields, deletedAt: null });
    return;
  }
  const row = { id, householdId: householdId && userId ? householdId : null, userId: uid, createdAt: now, deletedAt: null, ...fields };
  db.insert(dietaryProfiles).values(row).run();
  trackInsert('dietary_profiles', row);
}
