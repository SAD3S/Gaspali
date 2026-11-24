import { eq, isNull } from 'drizzle-orm';
import type { Slot } from '@/domain/planner';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { newId } from './ids';
import { mealPlan, type MealPlanRow } from './schema';

export function mealPlanQuery() {
  return db.select().from(mealPlan).where(isNull(mealPlan.deletedAt));
}

export function addMeal(date: string, slot: Slot, recipeId: string, servings: number): string {
  const now = new Date();
  const row = { id: newId(), householdId: ownership().householdId, createdAt: now, updatedAt: now, deletedAt: null, date, slot, recipeId, servings, done: false };
  db.insert(mealPlan).values(row).run();
  trackInsert('meal_plan', row);
  return row.id;
}

export function updateMeal(id: string, patch: Partial<Pick<MealPlanRow, 'date' | 'slot' | 'recipeId' | 'servings' | 'done'>>): void {
  const full = { ...patch, updatedAt: new Date() };
  db.update(mealPlan).set(full).where(eq(mealPlan.id, id)).run();
  trackPatch('meal_plan', id, full);
}

export function removeMeal(id: string): void {
  const now = new Date();
  db.update(mealPlan).set({ deletedAt: now, updatedAt: now }).where(eq(mealPlan.id, id)).run();
  trackPatch('meal_plan', id, { deletedAt: now, updatedAt: now });
}

/** Annule une suppression (snackbar « Annuler »). */
export function restoreMeal(id: string): void {
  const now = new Date();
  db.update(mealPlan).set({ deletedAt: null, updatedAt: now }).where(eq(mealPlan.id, id)).run();
  trackPatch('meal_plan', id, { deletedAt: null, updatedAt: now });
}
