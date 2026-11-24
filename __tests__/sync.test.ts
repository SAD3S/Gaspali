import {
  chunk,
  coalesceOutbox,
  formatInviteCode,
  fromServerRow,
  isValidInviteCode,
  normalizeInviteCode,
  pendingFields,
  toServerFields,
  withoutPending,
  type OutboxEntry,
} from '@/domain/sync';
import { columnSpecs } from '@/sync/tables';

const specs = columnSpecs('inventory_items');

describe('conversion local ↔ serveur', () => {
  it('convertit noms, dates et booléens', () => {
    const d = new Date(1_800_000_000_000);
    expect(toServerFields(specs, { expiresAt: d, expiryEstimated: true, quantity: 2, openedAt: null, location: 'frigo', inconnu: 1 })).toEqual({
      expires_at: 1_800_000_000_000,
      expiry_estimated: true,
      quantity: 2,
      opened_at: null,
      location: 'frigo',
    });
  });
  it('n’envoie jamais id ni household_id comme champs', () => {
    expect(toServerFields(specs, { id: 'x', householdId: 'h', name: 'A' })).toEqual({ name: 'A' });
  });
  it('relit une ligne serveur', () => {
    const local = fromServerRow(specs, {
      id: 'x', household_id: 'h', expires_at: 1_800_000_000_000, expiry_estimated: false, opened_at: null,
      field_ts: {}, server_seq: 12, name: 'Crème',
    });
    expect(local).toEqual({ id: 'x', householdId: 'h', expiresAt: new Date(1_800_000_000_000), expiryEstimated: false, openedAt: null, name: 'Crème' });
  });
  it('couvre toutes les colonnes de chaque table', () => {
    expect(columnSpecs('events').map((c) => c.name)).toContain('author_id');
    expect(columnSpecs('products').find((c) => c.name === 'deleted_at')?.kind).toBe('timestamp');
  });
});

describe('file d’attente', () => {
  const e = (seq: number, rowId: string, fields: Record<string, unknown>, ts: Record<string, number>, tableName = 'inventory_items'): OutboxEntry => ({
    seq, tableName, rowId, householdId: 'h', fields: fields as OutboxEntry['fields'], ts,
  });

  it('regroupe par ligne, garde la valeur la plus récente de chaque champ', () => {
    const out = coalesceOutbox([
      e(1, 'a', { quantity: 4, location: 'frigo' }, { quantity: 100, location: 100 }),
      e(2, 'a', { quantity: 3 }, { quantity: 200 }),
      e(3, 'b', { status: 'jete' }, { status: 150 }),
      e(4, 'p', { name: 'Lait' }, { name: 150 }, 'products'),
    ]);
    expect(out.get('inventory_items')).toEqual([
      { id: 'a', household_id: 'h', fields: { quantity: 3, location: 'frigo' }, ts: { quantity: 200, location: 100 } },
      { id: 'b', household_id: 'h', fields: { status: 'jete' }, ts: { status: 150 } },
    ]);
    expect(out.get('products')).toHaveLength(1);
  });

  it('une modification plus ancienne (horloge) ne remplace pas une plus récente', () => {
    const out = coalesceOutbox([e(1, 'a', { quantity: 3 }, { quantity: 500 }), e(2, 'a', { quantity: 9 }, { quantity: 400 })]);
    expect(out.get('inventory_items')?.[0]?.fields.quantity).toBe(3);
  });

  it('ne laisse pas une version serveur écraser un champ en attente', () => {
    const pending = pendingFields([e(1, 'a', { quantity: 3 }, { quantity: 500 })]);
    const remote = fromServerRow(specs, { id: 'a', quantity: 10, location: 'congelo' });
    expect(withoutPending(specs, remote, pending.get('inventory_items:a'))).toEqual({ id: 'a', location: 'congelo' });
    expect(withoutPending(specs, remote, pending.get('inventory_items:zzz'))).toEqual(remote);
  });
});

describe('codes d’invitation', () => {
  it('normalise et valide', () => {
    expect(normalizeInviteCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(isValidInviteCode('ABCD2345')).toBe(true);
    expect(isValidInviteCode('ABCD0345')).toBe(false); // 0 exclu (confusion avec O)
    expect(formatInviteCode('ABCD2345')).toBe('ABCD 2345');
  });
});

describe('chunk', () => {
  it('découpe en paquets', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
