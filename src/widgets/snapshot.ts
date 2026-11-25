import { computeFreshness, type DateType } from '@/domain/freshness';
import type { FreshnessState } from '@/theme/tokens';
import { normalizeText } from '@/domain/inventory';

/**
 * Données des widgets de l'écran d'accueil. L'app les enregistre à chaque changement ;
 * le widget les relit (même app fermée) et recalcule les jours restants au moment de l'affichage.
 */
export interface WidgetSnapshot {
  version: 1;
  items: { name: string; expiresAt: string; dateType: DateType }[];
  shopping: { name: string; detail: string | null }[];
  shoppingTotal: number;
}

export const WIDGET_SNAPSHOT_KEY = 'gaspalli.widget.snapshot';
export const WIDGET_MAX_ROWS = 12;

export function emptySnapshot(): WidgetSnapshot {
  return { version: 1, items: [], shopping: [], shoppingTotal: 0 };
}

interface ItemLike {
  name: string;
  expiresAt: Date;
  dateType: DateType;
  status?: string;
}
interface ShoppingLike {
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string;
  checked: boolean;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export function buildSnapshot(items: ItemLike[], shopping: ShoppingLike[]): WidgetSnapshot {
  const soonest = [...items]
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
    .slice(0, 30)
    .map((i) => ({ name: i.name, expiresAt: i.expiresAt.toISOString(), dateType: i.dateType }));
  const open = shopping
    .filter((s) => !s.checked)
    .sort((a, b) => a.aisle.localeCompare(b.aisle, 'fr') || normalizeText(a.name).localeCompare(normalizeText(b.name)));
  return {
    version: 1,
    items: soonest,
    shopping: open.slice(0, WIDGET_MAX_ROWS).map((s) => ({
      name: s.name,
      detail: s.quantity != null ? `${fmt(s.quantity)}${s.unit ? ` ${s.unit}` : ''}` : null,
    })),
    shoppingTotal: open.length,
  };
}

export interface UrgentRow {
  name: string;
  label: string;
  state: FreshnessState;
}

/** Produits à consommer vite (urgent, bientôt, périmé, à vérifier), du plus pressé au moins pressé. */
export function urgentRows(snapshot: WidgetSnapshot, today: Date = new Date()): UrgentRow[] {
  return snapshot.items
    .map((i) => ({ name: i.name, f: computeFreshness(new Date(i.expiresAt), i.dateType, today) }))
    .filter(({ f }) => f.state !== 'frais')
    .map(({ name, f }) => ({ name, label: f.label, state: f.state }));
}

export function parseSnapshot(raw: string | null): WidgetSnapshot {
  if (!raw) return emptySnapshot();
  try {
    const s = JSON.parse(raw) as WidgetSnapshot;
    return s && s.version === 1 && Array.isArray(s.items) && Array.isArray(s.shopping) ? s : emptySnapshot();
  } catch {
    return emptySnapshot();
  }
}
