import { parseBackup, reviveRow, toBackupRow } from '@/sync/backupFormat';

describe('sauvegarde des données', () => {
  it('refuse un fichier qui n’est pas une sauvegarde Gaspalli', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow('pas une sauvegarde Gaspalli');
    expect(() => parseBackup(null)).toThrow('pas une sauvegarde Gaspalli');
    expect(() => parseBackup({ app: 'gaspalli', format: 2, tables: {} })).toThrow('version plus récente');
    expect(() => parseBackup({ app: 'gaspalli', format: 1, tables: { pirates: [] } })).toThrow('table inconnue');
    expect(() => parseBackup({ app: 'gaspalli', format: 1, tables: { inventory_items: [{ name: 'x' }] } })).toThrow('sans identifiant');
  });

  it('aller-retour : une ligne exportée revient à l’identique, rattachée au foyer actif', () => {
    const item = {
      id: 'i1', householdId: 'ancien', createdAt: new Date(1_700_000_000_000), updatedAt: new Date(1_700_000_000_500), deletedAt: null,
      productId: null, name: 'Lait', brand: null, category: 'laitier', imageUrl: null, quantity: 1, unit: 'L', location: 'frigo',
      dateType: 'DLC', expiresAt: new Date(1_700_500_000_000), expiryEstimated: true, openedAt: null, status: 'en_stock', price: 0.99, addedBy: null,
    };
    const exported = toBackupRow('inventory_items', item);
    // Format lisible : snake_case, dates en millisecondes, pas de foyer.
    expect(exported).toMatchObject({ id: 'i1', expires_at: 1_700_500_000_000, expiry_estimated: true });
    expect(exported).not.toHaveProperty('household_id');
    const backup = parseBackup(JSON.parse(JSON.stringify({ app: 'gaspalli', format: 1, exportedAt: '', tables: { inventory_items: [exported] } })));
    expect(reviveRow('inventory_items', backup.tables.inventory_items![0]!, 'nouveau')).toEqual({ ...item, householdId: 'nouveau' });
  });
});
