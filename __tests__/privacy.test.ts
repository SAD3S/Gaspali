import { readFileSync, writeFileSync } from 'fs';
import { privacyMarkdown, privacySections } from '@/data/privacy';

const PATH = 'docs/confidentialite.md';
/** Adresse à remplacer par l'éditeur avant la publication sur les stores. */
const PLACEHOLDER = '[adresse e-mail de contact]';

test('la page web de la politique de confidentialité est à jour', () => {
  const expected = privacyMarkdown(PLACEHOLDER);
  if (process.env.UPDATE_PRIVACY) writeFileSync(PATH, expected);
  expect(readFileSync(PATH, 'utf8')).toBe(expected);
});

test('sans adresse de contact, la politique renvoie vers la fiche store', () => {
  const text = privacySections(null).flatMap((s) => s.items).join(' ');
  expect(text).toContain('Play Store');
  expect(text).not.toContain('undefined');
});
