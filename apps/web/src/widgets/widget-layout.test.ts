import { describe, expect, it } from 'vitest';
import {
  layoutReducer,
  mergeLayout,
  parseStoredLayout,
  sizeToSpan,
  storageKey,
  type WidgetDef,
  type WidgetState,
} from './widget-layout';

const defs: WidgetDef[] = [
  { id: 'a' },
  { id: 'b', defaultSize: 12 },
  { id: 'c', defaultSize: 4 },
];

describe('sizeToSpan', () => {
  it('returns the column span as-is within bounds', () => {
    expect(sizeToSpan(4)).toBe(4);
    expect(sizeToSpan(6)).toBe(6);
    expect(sizeToSpan(12)).toBe(12);
  });
  it('clamps out-of-range values to 1..12', () => {
    expect(sizeToSpan(0)).toBe(1);
    expect(sizeToSpan(99)).toBe(12);
    expect(sizeToSpan(5.4)).toBe(5);
  });
});

describe('storageKey', () => {
  it('namespaces the key', () => {
    expect(storageKey('analytics')).toBe('widget-layout:analytics:v1');
  });
});

describe('mergeLayout', () => {
  it('builds default state from defs when nothing persisted', () => {
    const state = mergeLayout(defs, null);
    expect(state.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(state[0]).toEqual({ id: 'a', hidden: false, size: 6 });
    expect(state[1].size).toBe(12);
    expect(state[2].size).toBe(4);
  });

  it('keeps persisted order and state for known ids', () => {
    const persisted: WidgetState[] = [
      { id: 'c', hidden: true, size: 12 },
      { id: 'a', hidden: false, size: 4 },
    ];
    const state = mergeLayout(defs, persisted);
    expect(state.map((s) => s.id)).toEqual(['c', 'a', 'b']);
    expect(state[0]).toEqual({ id: 'c', hidden: true, size: 12 });
    expect(state[2].id).toBe('b');
  });

  it('drops persisted ids no longer declared', () => {
    const persisted: WidgetState[] = [
      { id: 'zz', hidden: false, size: 6 },
      { id: 'a', hidden: false, size: 6 },
    ];
    const state = mergeLayout(defs, persisted);
    expect(state.find((s) => s.id === 'zz')).toBeUndefined();
    expect(state.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('layoutReducer', () => {
  const base = mergeLayout(defs, null);

  it('toggles hidden', () => {
    const next = layoutReducer(base, { type: 'toggleHidden', id: 'a' });
    expect(next.find((s) => s.id === 'a')!.hidden).toBe(true);
    expect(base.find((s) => s.id === 'a')!.hidden).toBe(false);
  });

  it('sets size and clamps', () => {
    expect(layoutReducer(base, { type: 'setSize', id: 'a', size: 9 }).find((s) => s.id === 'a')!.size).toBe(9);
    expect(layoutReducer(base, { type: 'setSize', id: 'a', size: 99 }).find((s) => s.id === 'a')!.size).toBe(12);
  });

  it('reorders from/to', () => {
    const next = layoutReducer(base, { type: 'reorder', from: 0, to: 2 });
    expect(next.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('resets to defs defaults', () => {
    const dirty = layoutReducer(base, { type: 'setSize', id: 'a', size: 12 });
    const next = layoutReducer(dirty, { type: 'reset', defs });
    expect(next).toEqual(mergeLayout(defs, null));
  });
});

describe('parseStoredLayout', () => {
  it('returns null on empty or invalid JSON', () => {
    expect(parseStoredLayout(null)).toBeNull();
    expect(parseStoredLayout('not json')).toBeNull();
    expect(parseStoredLayout('{}')).toBeNull();
  });

  it('returns null when size is not a valid column number (legacy string sizes)', () => {
    expect(parseStoredLayout(JSON.stringify([{ id: 'a', hidden: false, size: 'half' }]))).toBeNull();
  });

  it('parses a valid array', () => {
    const raw = JSON.stringify([{ id: 'a', hidden: false, size: 6 }]);
    expect(parseStoredLayout(raw)).toEqual([{ id: 'a', hidden: false, size: 6 }]);
  });
});
