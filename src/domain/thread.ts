/**
 * Le « fil » Gaspalli : un liseré qui serpente sur l'écran en faisant des boucles de tailles variées
 * (cycloïde allongée le long d'une courbe lisse). Calcul pur, déterministe pour un même écran.
 */
export type Pt = readonly [number, number];

/** Courbe de Catmull-Rom passant par les points, échantillonnée finement. */
export function spline(pts: Pt[], perSegment: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Fil qui boucle le long d'une courbe : `loops` boucles, rayon modulé entre 25 % et 100 % de `radius`. */
export function loopThread(spine: Pt[], loops: number, radius: number, waves: number): Pt[] {
  // Une quarantaine de points par boucle : des boucles rondes, pas des polygones.
  const base = spline(spine, Math.max(12, Math.ceil((loops * 40) / Math.max(1, spine.length - 1))));
  const m = base.length;
  return base.map((b, i) => {
    const a = base[Math.max(0, i - 1)]!, c = base[Math.min(m - 1, i + 1)]!;
    let tx = c[0] - a[0], ty = c[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const s = i / (m - 1), th = 2 * Math.PI * loops * s;
    const r = radius * (0.25 + 0.75 * Math.sin(Math.PI * waves * s) ** 2);
    return [b[0] - tx * r * Math.sin(th) - ty * r * (1 - Math.cos(th)), b[1] - ty * r * Math.sin(th) + tx * r * (1 - Math.cos(th))] as const;
  });
}

/** Générateur pseudo-aléatoire reproductible (même écran → même fil). */
function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Fil de fond pour un écran : il entre à gauche en haut, zigzague sur toute la hauteur et sort en bas.
 * `variant` change le tracé d'un écran à l'autre.
 */
export function screenThread(width: number, height: number, variant = 1): { d: string; length: number } {
  const rnd = seeded(variant * 7919 + 13);
  // Peu de virages et de grandes boucles espacées : un fil aérien, pas un ressort.
  const rows = Math.max(3, Math.round(height / 220));
  const spine: Pt[] = [[-30, height * 0.08]];
  for (let i = 1; i < rows; i++) {
    const left = i % 2 === (variant % 2);
    spine.push([width * (left ? 0.12 + rnd() * 0.2 : 0.68 + rnd() * 0.2), (height * i) / rows + (rnd() - 0.5) * 40]);
  }
  spine.push([width + 30, height * 0.98]);
  const loops = Math.max(5, Math.round(height / 95));
  const pts = loopThread(spine, loops, Math.min(58, width / 6.5), 2);
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  const d = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
  return { d, length: Math.ceil(length) };
}
