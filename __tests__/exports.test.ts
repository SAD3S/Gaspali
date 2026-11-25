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

const installed = (pkg: string) => (JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')) as { version: string }).version;

test('generate-recipe : versions épinglées dans deno.json = versions vérifiées localement', () => {
  const deno = JSON.parse(readFileSync('supabase/functions/generate-recipe/deno.json', 'utf8')) as { imports: Record<string, string> };
  for (const [pkg, spec] of Object.entries(deno.imports)) {
    expect(`${pkg}@${installed(pkg)}`).toBe(`${pkg}@${spec.replace(`npm:${pkg}@`, '')}`);
  }
});

test('delete-account : version épinglée dans le code = version vérifiée localement', () => {
  const source = readFileSync('supabase/functions/delete-account/index.ts', 'utf8');
  const specs = [...source.matchAll(/'npm:(@?[^@']+)@([^']+)'/g)];
  expect(specs.length).toBeGreaterThan(0);
  for (const [, pkg, version] of specs) expect(`${pkg}@${installed(pkg!)}`).toBe(`${pkg}@${version}`);
});
