/**
 * Génère les icônes de l'app (assets/) et l'icône du store (docs/store/) à partir de la feuille Lucide.
 * Usage : node scripts/generate-icons.js  (nécessite Playwright et Chromium installés).
 * Puis convertir assets/icon.png en RGB (iOS refuse la transparence).
 */
const { chromium } = require('playwright');
const path = require('path');
const ASSETS = path.join(__dirname, '..', 'assets');
const STORE = path.join(__dirname, '..', 'docs', 'store');
// Feuille Lucide (24×24), la même que dans l'app.
const LEAF = (stroke, width) => `<g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></g>`;
const GREEN = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A8F5C"/><stop offset="1" stop-color="#1A6B43"/></linearGradient></defs>`;
// leafScale : part de la largeur occupée par la feuille.
function svg({ size, bg, radius = 0, leafScale, stroke = '#FFFFFF', width = 2.1 }) {
  const leaf = size * leafScale;
  const offset = (size - leaf) / 2;
  const s = leaf / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${GREEN}
    ${bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : ''}
    <g transform="translate(${offset} ${offset}) scale(${s})">${LEAF(stroke, width)}</g></svg>`;
}
const jobs = [
  // Icône iOS / générale : carré plein (le système arrondit les coins).
  { file: `${ASSETS}/icon.png`, size: 1024, bg: 'url(#g)', leafScale: 0.56 },
  { file: `${STORE}/icone-512.png`, size: 512, bg: 'url(#g)', leafScale: 0.56 },
  // Android adaptatif : premier plan dans la zone sûre (≈ 66 % du centre), fond uni.
  { file: `${ASSETS}/android-icon-foreground.png`, size: 1024, bg: null, leafScale: 0.44 },
  { file: `${ASSETS}/android-icon-background.png`, size: 1024, bg: '#1F7A4D', leafScale: 0 },
  { file: `${ASSETS}/android-icon-monochrome.png`, size: 1024, bg: null, leafScale: 0.44 },
  // Écran de démarrage : la tuile verte arrondie de la maquette, fond transparent.
  { file: `${ASSETS}/splash-icon.png`, size: 1024, bg: 'url(#g)', radius: 230, leafScale: 0.56 },
  { file: `${ASSETS}/favicon.png`, size: 48, bg: 'url(#g)', radius: 11, leafScale: 0.6, width: 2.4 },
  // Petite icône de notification Android : silhouette blanche sur transparent.
  { file: `${ASSETS}/notification-icon.png`, size: 96, bg: null, leafScale: 0.8, width: 2.4 },
];
(async () => {
  require('fs').mkdirSync(STORE, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const j of jobs) {
    await p.setViewportSize({ width: j.size, height: j.size });
    const body = j.leafScale === 0 ? svg({ ...j, leafScale: 0.0001, stroke: 'transparent' }) : svg(j);
    await p.setContent(`<html><body style="margin:0;background:transparent">${body}</body></html>`);
    await p.screenshot({ path: j.file, omitBackground: true, clip: { x: 0, y: 0, width: j.size, height: j.size } });
    console.log('ok', path.basename(j.file));
  }
  await b.close();
})();
