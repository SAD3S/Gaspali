/// <reference types="node" />
import { readFileSync, writeFileSync } from 'fs';
import { INGREDIENTS } from '@/data/ingredients';

// Les Edge Functions (Deno) ne peuvent pas importer le code de l'app : la table d'ingrédients
// leur est fournie en JSON. Régénérer : UPDATE_EXPORTS=1 npx jest __tests__/exports.test.ts
const PATH = 'supabase/functions/_shared/ingredients.json';

test('supabase/functions/_shared/ingredients.json est à jour', () => {
  const expected = JSON.stringify(
    INGREDIENTS.map(({ id, name, synonyms, allergens, diet, exclude }) => ({ id, name, synonyms, allergens, diet, exclude })),
    null,
    1,
  ) + '\n';
  if (process.env.UPDATE_EXPORTS) writeFileSync(PATH, expected);
  expect(readFileSync(PATH, 'utf8')).toBe(expected);
});

test.each(['generate-recipe', 'delete-account'])('%s : versions épinglées dans deno.json = versions vérifiées localement', (fn) => {
  const deno = JSON.parse(readFileSync(`supabase/functions/${fn}/deno.json`, 'utf8')) as { imports: Record<string, string> };
  for (const [pkg, spec] of Object.entries(deno.imports)) {
    const version = spec.replace(`npm:${pkg}@`, '');
    const installed = (JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')) as { version: string }).version;
    expect(`${pkg}@${installed}`).toBe(`${pkg}@${version}`);
  }
});
