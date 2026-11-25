import type { PepinMood } from './Pepin';

/** Tracés de Pépin (viewBox 120×120), partagés par l'app et les widgets. */
export const PEPIN_PATHS = {
  body: 'M60 40C36 30 22 52 26 72C30 96 48 105 60 99C72 105 90 96 94 72C98 52 84 30 60 40Z',
  stalk: 'M60 40C60 32 61 26 65 20',
  leaf: 'M63 28C70 17 84 17 88 23C80 30 70 31 63 28Z',
  string: 'M60 99C58 108 50 114 42 110C36 106 42 98 48 104C52 108 46 116 34 116',
};

/** Pépin en SVG texte (widgets Android, qui ne savent pas afficher de composant). */
export function pepinSvg(mood: PepinMood, c: { primary: string; soft: string; ink: string }): string {
  const st = (d: string, w = 3.2, color = c.primary, fill = 'none') =>
    `<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const eye = (x: number) => `<circle cx="${x}" cy="66" r="3.2" fill="${c.ink}"/>`;
  const face =
    mood === 'joie'
      ? st('M46 67Q50 62 54 67M66 67Q70 62 74 67', 2.6, c.ink) + `<path d="M53 75Q60 86 67 75Z" fill="${c.ink}"/>`
      : mood === 'clin'
        ? eye(50) + st('M66 67Q70 63 74 67', 2.6, c.ink) + st('M54 76Q60 82 66 76', 2.6)
        : mood === 'oups'
          ? eye(50) + eye(70) + `<circle cx="60" cy="78" r="3.6" fill="none" stroke="${c.primary}" stroke-width="2.4"/>`
          : eye(50) + eye(70) + st('M54 76Q60 82 66 76', 2.6);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
    `<path d="${PEPIN_PATHS.body}" fill="${c.soft}"/>` +
    st(PEPIN_PATHS.body) +
    st(PEPIN_PATHS.stalk) +
    st(PEPIN_PATHS.leaf, 3.2, c.primary, c.soft) +
    st(PEPIN_PATHS.string, 2.4) +
    face +
    `<circle cx="44" cy="75" r="4" fill="#F4A38E" opacity="0.8"/><circle cx="76" cy="75" r="4" fill="#F4A38E" opacity="0.8"/>` +
    `</svg>`
  );
}
