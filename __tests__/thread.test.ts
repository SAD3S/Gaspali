import { loopThread, screenThread, spline } from '@/domain/thread';

describe('fil de fond', () => {
  it('la courbe passe par les points donnés', () => {
    const pts = spline([[0, 0], [100, 50], [200, 0]], 10);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10]).toEqual([100, 50]);
    expect(pts[pts.length - 1]).toEqual([200, 0]);
  });

  it('fait de vraies boucles (le fil revient en arrière)', () => {
    const pts = loopThread([[0, 0], [600, 0]], 8, 30, 1);
    let backwards = 0;
    for (let i = 1; i < pts.length; i++) if (pts[i]![0] < pts[i - 1]![0]) backwards++;
    expect(backwards).toBeGreaterThan(20);
  });

  it('est identique pour un même écran et change d’un écran à l’autre', () => {
    expect(screenThread(390, 844, 2).d).toBe(screenThread(390, 844, 2).d);
    expect(screenThread(390, 844, 2).d).not.toBe(screenThread(390, 844, 3).d);
    const { d, length } = screenThread(390, 844, 1);
    expect(d.startsWith('M')).toBe(true);
    expect(length).toBeGreaterThan(844);
  });
});
