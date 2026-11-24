import { monthGrid } from '@/components/ui/CalendarSheet';

describe('monthGrid', () => {
  it('commence le lundi et complète les semaines', () => {
    const g = monthGrid(2026, 10); // novembre 2026 : le 1er est un dimanche
    expect(g.length % 7).toBe(0);
    expect(g.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(g[6]?.getDate()).toBe(1);
    expect(g.filter(Boolean)).toHaveLength(30);
  });
});
