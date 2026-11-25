import { freshnessPalettes, palettes } from '@/theme/tokens';

/** Rapport de contraste WCAG 2. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe.each(['light', 'dark'] as const)('thème %s', (scheme) => {
  const c = palettes[scheme];
  it('texte lisible (WCAG AA, 4,5 : 1)', () => {
    const pairs: [string, string, string][] = [
      ['texte / fond', c.text, c.background],
      ['texte / carte', c.text, c.surface],
      ['secondaire / fond', c.textSecondary, c.background],
      ['secondaire / carte', c.textSecondary, c.surface],
      ['lien vert / carte', c.primaryText, c.surface],
      ['bouton vert', c.onPrimary, c.primary],
      ['danger', c.onDanger, c.danger],
      ['vert / pastille verte', c.primaryText, c.primarySoft],
    ];
    for (const [name, fg, bg] of pairs) expect([name, contrast(fg, bg) >= 4.5]).toEqual([name, true]);
  });
  it('pastilles de fraîcheur lisibles', () => {
    for (const [state, f] of Object.entries(freshnessPalettes[scheme])) expect([state, contrast(f.fg, f.bg) >= 4.5]).toEqual([state, true]);
  });
});

it('thème sombre : fond gris neutre (pas teinté) et cartes qui se détachent', () => {
  const { background, surface } = palettes.dark;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16));
  expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThanOrEqual(2);
  expect(contrast(surface, background)).toBeGreaterThanOrEqual(1.15);
});
