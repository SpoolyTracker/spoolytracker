import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  layoutReducer,
  mergeLayout,
  parseStoredLayout,
  storageKey,
  type LayoutAction,
  type WidgetDef,
  type WidgetSize,
  type WidgetState,
} from './widget-layout';

function readInitial(namespace: string, defs: WidgetDef[]): WidgetState[] {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey(namespace));
  } catch {
    stored = null;
  }
  return mergeLayout(defs, parseStoredLayout(stored));
}

export interface UseWidgetLayout {
  items: WidgetState[];
  isEditing: boolean;
  hasHidden: boolean;
  setEditing: (v: boolean) => void;
  toggleHidden: (id: string) => void;
  setSize: (id: string, size: WidgetSize) => void;
  reorder: (from: number, to: number) => void;
  reset: () => void;
}

export function useWidgetLayout(namespace: string, defs: WidgetDef[]): UseWidgetLayout {
  const [items, dispatch] = useReducer(
    layoutReducer,
    undefined as unknown as WidgetState[],
    () => readInitial(namespace, defs),
  );
  const [isEditing, setEditing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(namespace), JSON.stringify(items));
    } catch {
      /* quota / mode privé : on ignore, l'état reste en mémoire */
    }
  }, [namespace, items]);

  const dispatchAction = useCallback((a: LayoutAction) => dispatch(a), []);

  return useMemo(
    () => ({
      items,
      isEditing,
      hasHidden: items.some((i) => i.hidden),
      setEditing,
      toggleHidden: (id: string) => dispatchAction({ type: 'toggleHidden', id }),
      setSize: (id: string, size: WidgetSize) => dispatchAction({ type: 'setSize', id, size }),
      reorder: (from: number, to: number) => dispatchAction({ type: 'reorder', from, to }),
      reset: () => dispatchAction({ type: 'reset', defs }),
    }),
    [items, isEditing, dispatchAction, defs],
  );
}
