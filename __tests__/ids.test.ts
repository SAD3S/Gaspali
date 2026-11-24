jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
// eslint-disable-next-line import/first
import { stableUuid } from '@/db/ids';

describe('stableUuid', () => {
  it('est déterministe et au format UUID v5', () => {
    const a = stableUuid('foyer-1:user-1');
    expect(stableUuid('foyer-1:user-1')).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(stableUuid('foyer-1:user-2')).not.toBe(a);
  });
});
