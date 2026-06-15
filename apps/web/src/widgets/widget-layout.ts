// Taille d'un widget = nombre de colonnes occupées sur la grille MUI 12 colonnes (1..12).
export type WidgetSize = number;

export interface WidgetState {
  id: string;
  hidden: boolean;
  size: WidgetSize;
}

export interface WidgetDef {
  id: string;
  defaultSize?: WidgetSize;
}

export const MIN_SPAN = 1;
export const MAX_SPAN = 12;
export const DEFAULT_SPAN = 6;

export function sizeToSpan(size: WidgetSize): number {
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, Math.round(size)));
}

export function storageKey(namespace: string): string {
  return `widget-layout:${namespace}:v1`;
}

export function mergeLayout(
  defs: WidgetDef[],
  persisted: WidgetState[] | null,
): WidgetState[] {
  const defById = new Map(defs.map((d) => [d.id, d]));
  const result: WidgetState[] = [];
  const seen = new Set<string>();

  if (persisted) {
    for (const item of persisted) {
      if (defById.has(item.id) && !seen.has(item.id)) {
        result.push({ id: item.id, hidden: !!item.hidden, size: sizeToSpan(item.size) });
        seen.add(item.id);
      }
    }
  }
  for (const def of defs) {
    if (!seen.has(def.id)) {
      result.push({ id: def.id, hidden: false, size: sizeToSpan(def.defaultSize ?? DEFAULT_SPAN) });
      seen.add(def.id);
    }
  }
  return result;
}

export type LayoutAction =
  | { type: 'toggleHidden'; id: string }
  | { type: 'setSize'; id: string; size: WidgetSize }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'reset'; defs: WidgetDef[] };

export function layoutReducer(state: WidgetState[], action: LayoutAction): WidgetState[] {
  switch (action.type) {
    case 'toggleHidden':
      return state.map((s) => (s.id === action.id ? { ...s, hidden: !s.hidden } : s));
    case 'setSize':
      return state.map((s) => (s.id === action.id ? { ...s, size: sizeToSpan(action.size) } : s));
    case 'reorder': {
      const next = [...state];
      const [moved] = next.splice(action.from, 1);
      if (moved) next.splice(action.to, 0, moved);
      return next;
    }
    case 'reset':
      return mergeLayout(action.defs, null);
    default:
      return state;
  }
}

export function parseStoredLayout(raw: string | null): WidgetState[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const ok = parsed.every(
      (x) =>
        x && typeof x.id === 'string' && typeof x.hidden === 'boolean' &&
        typeof x.size === 'number' && x.size >= MIN_SPAN && x.size <= MAX_SPAN,
    );
    return ok ? (parsed as WidgetState[]) : null;
  } catch {
    return null;
  }
}
