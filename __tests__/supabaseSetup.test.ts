import { readdirSync, readFileSync, writeFileSync } from 'fs';

const PATH = 'supabase/setup.sql';

/** Toutes les migrations, dans l'ordre, en un seul fichier à coller dans l'éditeur SQL de Supabase. */
function expected(): string {
  const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const header = [
    '-- Gaspalli — schéma complet, à exécuter UNE fois dans un projet Supabase neuf',
    '-- (Dashboard › SQL Editor › New query › coller › Run).',
    '-- Fichier généré à partir de supabase/migrations/ : ne pas le modifier à la main',
    '-- (UPDATE_SETUP=1 npx jest __tests__/supabaseSetup.test.ts pour le régénérer).',
    '',
  ].join('\n');
  return header + files.map((f) => `\n-- ═══ ${f} ═══\n\n${readFileSync(`supabase/migrations/${f}`, 'utf8').trim()}\n`).join('');
}

test('supabase/setup.sql reprend toutes les migrations, dans l’ordre', () => {
  if (process.env.UPDATE_SETUP) writeFileSync(PATH, expected());
  expect(readFileSync(PATH, 'utf8')).toBe(expected());
});
