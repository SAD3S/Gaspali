import { BUILTIN_RECIPES } from '@/data/recipes';
import { isNoCook, missingEquipment, recipeEquipment } from '@/domain/equipment';

const steps = (...s: string[]) => ({ steps: s });
const byTitle = (t: string) => BUILTIN_RECIPES.find((r) => r.title === t)!;

describe('équipement des recettes', () => {
  it('déduit l’équipement des étapes', () => {
    expect(recipeEquipment(steps('Préchauffe le four à 180 °C.', 'Enfourne 30 min.'))).toEqual(['four']);
    expect(recipeEquipment(steps('Fais revenir l’oignon dans une poêle.'))).toEqual(['plaques']);
    expect(recipeEquipment(steps('Fais cuire les pâtes.'))).toEqual(['plaques']);
    expect(recipeEquipment(steps('Fais cuire 30 min au four.'))).toEqual(['four']);
    expect(recipeEquipment(steps('Fais chauffer 2 min au micro-ondes.'))).toEqual(['micro_ondes']);
    expect(recipeEquipment(steps('Mixe 1 min.'))).toEqual(['mixeur']);
    expect(recipeEquipment(steps('Monte les blancs au batteur.'))).toEqual(['batteur']);
    expect(recipeEquipment(steps('Coupe les fruits.', 'Garde au frais.'))).toEqual([]);
  });

  it('ne confond pas « fourchette » avec le four, ni « écrase ou mixe » avec un mixeur obligatoire', () => {
    expect(recipeEquipment(steps('Écrase à la fourchette.'))).toEqual([]);
    expect(recipeEquipment(steps('Fais cuire 20 min dans une casserole.', 'Écrase ou mixe selon la texture voulue.'))).toEqual(['plaques']);
  });

  it('classe correctement les recettes de base', () => {
    expect(recipeEquipment(byTitle('Gratin dauphinois'))).toEqual(['four']);
    expect(recipeEquipment(byTitle('Soupe à l’oignon gratinée'))).toEqual(['plaques', 'four']);
    expect(recipeEquipment(byTitle('Smoothie banane-fruits rouges'))).toEqual(['mixeur']);
    expect(isNoCook(byTitle('Salade de fruits'))).toBe(true);
    expect(isNoCook(byTitle('Pâtes à la carbonara'))).toBe(false);
  });

  it('dit ce qui manque au foyer', () => {
    const owned = new Set(['plaques', 'micro_ondes'] as const);
    expect(missingEquipment(byTitle('Gratin dauphinois'), owned)).toEqual(['four']);
    expect(missingEquipment(byTitle('Crêpes'), owned)).toEqual([]);
  });
});
