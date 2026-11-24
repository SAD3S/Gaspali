import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() } }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/ui/Snackbar', () => ({ useSnackbar: () => ({ show: jest.fn() }), SnackbarProvider: ({ children }: { children: unknown }) => children }));
jest.mock('@/features/account/AuthProvider', () => ({
  useAuth: () => ({ cloud: true, session: { user: { id: 'u1' } }, active: { id: '52f19460-5df1-4dd5-82bc-c46e96a7ad1f', name: 'Chez nous', inviteCode: 'ABCD2345', role: 'admin' } }),
}));
jest.mock('@/features/inventory/hooks', () => ({ useInventory: () => [] }));
jest.mock('@/features/settings/settings', () => ({ useSettings: () => ({ basics: ['sel'] }) }));
jest.mock('@/features/recipes/hooks', () => ({
  useHouseholdPrefs: () => ({ members: [{ name: 'Toi', diet: 'omnivore', allergens: ['lait'], dislikes: [] }], mine: {} }),
}));
const mockSave = jest.fn(() => 'nouvelle-id');
jest.mock('@/db/recipesRepo', () => ({ saveRecipe: (...a: unknown[]) => mockSave(...(a as [])) }));
jest.mock('@/services/supabase', () => ({ supabase: null }));
jest.mock('@supabase/supabase-js', () => ({ FunctionsHttpError: class {}, FunctionsFetchError: class {} }));

// eslint-disable-next-line import/first
import RecetteIA from '../app/recettes/ia';
// eslint-disable-next-line import/first
import * as ai from '@/services/aiRecipes';

const { AiRecipeError } = ai;
const mockGenerate = jest.spyOn(ai, 'generateAiRecipe');

const recipe = {
  title: 'Poêlée de légumes express',
  minutes: 20,
  servings: 2,
  kind: 'plat',
  tags: ['rapide', 'ia'],
  ingredients: [
    { ingredientId: 'courgette', quantity: 1, unit: 'pièce' },
    { ingredientId: 'huile', quantity: 1, unit: 'c. à s.' },
  ],
  steps: ['Coupe la courgette en dés.', 'Fais-la sauter 10 min à feu vif.'],
};

async function renderScreen() {
  return render(<ThemeProvider><RecetteIA /></ThemeProvider>);
}

describe('écran « Invente-moi une recette »', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    mockSave.mockClear();
  });

  it('rappelle les allergies prises en compte', async () => {
    await renderScreen();
    expect(screen.getByText(/allergies \(lait\) jamais utilisées/)).toBeTruthy();
  });

  it('affiche la recette générée et l’enregistre dans Mes recettes', async () => {
    mockGenerate.mockResolvedValue({ recipe, cached: false, remaining: 4 });
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Inventer une recette'));
    expect(await screen.findByText('Poêlée de légumes express')).toBeTruthy();
    expect(screen.getByText('Encore 4 idées aujourd’hui pour ton foyer.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer dans Mes recettes'));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Poêlée de légumes express', source: 'ia' }));
  });

  it('bloque l’enregistrement si la recette contient un allergène déclaré (défense en profondeur)', async () => {
    mockGenerate.mockResolvedValue({ recipe: { ...recipe, ingredients: [...recipe.ingredients, { ingredientId: 'beurre', quantity: 10, unit: 'g' }] }, cached: false, remaining: 3 });
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Inventer une recette'));
    expect(await screen.findByText(/Contient : Lait/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer dans Mes recettes'));
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('affiche le message du serveur quand le quota est atteint', async () => {
    mockGenerate.mockRejectedValue(new AiRecipeError('quota', 'Tu as utilisé les 5 idées IA du jour pour ton foyer. Reviens demain !'));
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Inventer une recette'));
    expect(await screen.findByText(/Reviens demain/)).toBeTruthy();
  });
});
