// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { normalizePanelWidths } from '../../src/components/FileViewer';

const LAYERS_MIN = 180;
const EDITOR_MIN = 280;
const PREVIEW_MIN = 280;
const SUM_OF_MINS = LAYERS_MIN + EDITOR_MIN + PREVIEW_MIN; // 740

// Workspace CSS: padding 10px each side, gap 10px, handle 8px
const HANDLE_W = 8;
const GAP = 10;
const PAD = 10;

/** Simulates the useLayoutEffect available-width computation from clientWidth. */
function availableFromClientWidth(clientWidth: number): number {
  return clientWidth - PAD * 2 - HANDLE_W * 2 - 4 * GAP;
}

describe('normalizePanelWidths', () => {
  it('returns values unchanged when they fit within available width', () => {
    const r = normalizePanelWidths(240, 420, 344, 1200);
    expect(r).toEqual({ layers: 240, editor: 420, preview: 344 });
  });

  it('does nothing when values already equal available width exactly', () => {
    const available = 240 + 420 + 344;
    const r = normalizePanelWidths(240, 420, 344, available);
    expect(r).toEqual({ layers: 240, editor: 420, preview: 344 });
  });

  it('lifts values below their minimums even without overflow', () => {
    const r = normalizePanelWidths(100, 200, 100, 1200);
    expect(r).toEqual({ layers: LAYERS_MIN, editor: EDITOR_MIN, preview: PREVIEW_MIN });
  });

  it('squeezes the editor first when panels overflow', () => {
    // sum = 240 + 420 + 300 = 960, available = 900, overflow = 60
    const r = normalizePanelWidths(240, 420, 300, 900);
    expect(r.layers).toBe(240);
    expect(r.preview).toBe(300);
    expect(r.editor).toBe(360); // 420 - 60
    expect(r.layers + r.editor + r.preview).toBe(900);
  });

  it('squeezes side panels after editor hits its minimum', () => {
    // sum = 240 + 290 + 320 = 850, available = 750, overflow = 100
    // editor can only give 10 (290->280), overflow = 90
    // layers can give 60 (240->180), overflow = 30
    // preview absorbs remaining 30 (320->290)
    const r = normalizePanelWidths(240, 290, 320, 750);
    expect(r.editor).toBe(EDITOR_MIN); // 280
    expect(r.layers).toBe(LAYERS_MIN); // 180
    expect(r.preview).toBe(290); // 320 - 30
    expect(r.layers + r.editor + r.preview).toBe(750);
  });

  it('clamps editor and layers to minimums when available is barely above sum of minimums', () => {
    // available = 750 (just 10 above sum of mins)
    // editor 450→280 (170), layers 300→180 (120), preview 400→290 (110)
    const r = normalizePanelWidths(300, 450, 400, SUM_OF_MINS + 10);
    expect(r.editor).toBe(EDITOR_MIN);
    expect(r.layers).toBe(LAYERS_MIN);
    expect(r.preview).toBe(290); // absorbs remaining overflow
    expect(r.layers + r.editor + r.preview).toBe(SUM_OF_MINS + 10);
  });

  it('handles large-monitor widths restored on a smaller split workspace', () => {
    // 850px clientWidth → available = 850 - 20 - 16 - 40 = 774
    const available = availableFromClientWidth(850);
    expect(available).toBe(774);
    const r = normalizePanelWidths(400, 600, 500, available);

    // sum = 1500, overflow = 726
    // editor: 600 -> 280 (320), overflow = 406
    // layers: 400 -> 180 (220), overflow = 186
    // preview: 500 -> 314 (186)
    expect(r.editor).toBe(EDITOR_MIN);
    expect(r.layers).toBe(LAYERS_MIN);
    expect(r.preview).toBe(314);
    expect(r.layers + r.editor + r.preview).toBe(774);
  });

  it('handles a single oversized panel on an otherwise normal workspace', () => {
    // 900px clientWidth → available = 900 - 76 = 824
    const available = availableFromClientWidth(900);
    expect(available).toBe(824);
    const r = normalizePanelWidths(800, 420, 344, available);

    // sum = 1564, overflow = 740
    // editor: 420 -> 280 (140), overflow = 600
    // layers: 800 -> 200 (600), overflow = 0
    expect(r.editor).toBe(EDITOR_MIN);
    expect(r.preview).toBe(344);
    expect(r.layers).toBe(200);
    expect(r.layers + r.editor + r.preview).toBe(824);
  });

  it('rounds fractional panel widths', () => {
    const r = normalizePanelWidths(240.7, 420.3, 344.5, 1200);
    expect(r.layers).toBe(241);
    expect(r.editor).toBe(420);
    expect(r.preview).toBe(345);
  });

  it('returns minimums when available is less than sum of minimums', () => {
    const r = normalizePanelWidths(200, 300, 300, SUM_OF_MINS - 1);
    expect(r.layers).toBe(LAYERS_MIN);
    expect(r.editor).toBe(EDITOR_MIN);
    expect(r.preview).toBe(PREVIEW_MIN);
  });
});

describe('normalizePanelWidths — ARIA and minimum invariants', () => {
  it('never returns a value below its declared minimum', () => {
    const cases = [
      [800, 600, 500, 400],
      [100, 200, 100, 800],
      [500, 600, 500, 300],
      [240, 420, 344, 741],
    ] as const;
    for (const [l, e, p, a] of cases) {
      const r = normalizePanelWidths(l, e, p, a);
      expect(r.layers, `layers for (${l},${e},${p},${a})`).toBeGreaterThanOrEqual(LAYERS_MIN);
      expect(r.editor, `editor for (${l},${e},${p},${a})`).toBeGreaterThanOrEqual(EDITOR_MIN);
      expect(r.preview, `preview for (${l},${e},${p},${a})`).toBeGreaterThanOrEqual(PREVIEW_MIN);
    }
  });

  it('returned widths satisfy ARIA bounds: valuenow <= valuemax', () => {
    // After normalization, simulate the ARIA max computation that runs in the component:
    //   ariaLayersMax = max(LAYERS_MIN, layers + editor - EDITOR_MIN)
    //   ariaPreviewMax = max(PREVIEW_MIN, preview + editor - EDITOR_MIN)
    // Verify valuenow (the actual width) <= valuemax.
    const cases = [
      [800, 600, 500, availableFromClientWidth(900)],
      [400, 600, 500, availableFromClientWidth(850)],
      [240, 420, 344, availableFromClientWidth(1200)],
    ] as const;
    for (const [l, e, p, a] of cases) {
      const r = normalizePanelWidths(l, e, p, a);
      const layersMax = Math.max(LAYERS_MIN, r.layers + r.editor - EDITOR_MIN);
      const previewMax = Math.max(PREVIEW_MIN, r.preview + r.editor - EDITOR_MIN);
      expect(r.layers, `layers <= max for (${l},${e},${p})`).toBeLessThanOrEqual(layersMax);
      expect(r.preview, `preview <= max for (${l},${e},${p})`).toBeLessThanOrEqual(previewMax);
      // Also valuemax >= valuemin (always true by construction, but verify)
      expect(layersMax).toBeGreaterThanOrEqual(LAYERS_MIN);
      expect(previewMax).toBeGreaterThanOrEqual(PREVIEW_MIN);
    }
  });

  it('sum never exceeds available when available >= sum of minimums', () => {
    const available = SUM_OF_MINS + 200;
    const r = normalizePanelWidths(500, 600, 500, available);
    expect(r.layers + r.editor + r.preview).toBeLessThanOrEqual(available);
    expect(r.layers).toBeGreaterThanOrEqual(LAYERS_MIN);
    expect(r.editor).toBeGreaterThanOrEqual(EDITOR_MIN);
    expect(r.preview).toBeGreaterThanOrEqual(PREVIEW_MIN);
  });
});

describe('normalizePanelWidths — content-box available width with real CSS budget', () => {
  it('deducts padding, gaps, and handles from clientWidth correctly', () => {
    // Simulates the real computation: clientWidth=1100 → available=1024
    // 1100 - 2*10(pad) - 2*8(handle) - 4*10(gap) = 1024
    expect(availableFromClientWidth(1100)).toBe(1024);
    expect(availableFromClientWidth(850)).toBe(774);
    expect(availableFromClientWidth(756)).toBe(680); // just above sum of mins
  });

  it('default widths (240+420+344=1004) fit in a 1100px clientWidth workspace', () => {
    const available = availableFromClientWidth(1100);
    const r = normalizePanelWidths(240, 420, 344, available);
    expect(r).toEqual({ layers: 240, editor: 420, preview: 344 });
    expect(r.layers + r.editor + r.preview).toBeLessThanOrEqual(available);
  });

  it('large persisted widths on a constrained 850px workspace are clamped', () => {
    // clientWidth=850, available=774
    // Saved: layers=500, editor=450, preview=400 → sum=1350
    const available = availableFromClientWidth(850);
    const r = normalizePanelWidths(500, 450, 400, available);
    // overflow = 1350 - 774 = 576
    // editor: 450 -> 280 (170), overflow = 406
    // layers: 500 -> 180 (320), overflow = 86
    // preview: 400 -> 314 (86)
    expect(r.layers + r.editor + r.preview).toBe(available);
    expect(r.layers).toBeGreaterThanOrEqual(LAYERS_MIN);
    expect(r.editor).toBeGreaterThanOrEqual(EDITOR_MIN);
    expect(r.preview).toBeGreaterThanOrEqual(PREVIEW_MIN);
  });
});

describe('normalizePanelWidths — workspace resize during active session', () => {
  it('re-normalizes when workspace shrinks mid-session', () => {
    // Initial: 1100px workspace → default widths (1004) fit in 1024
    const available1 = availableFromClientWidth(1100);
    const r1 = normalizePanelWidths(240, 420, 344, available1);
    expect(r1).toEqual({ layers: 240, editor: 420, preview: 344 });

    // User drags chat split wider → workspace shrinks to 850px → 774
    const available2 = availableFromClientWidth(850);
    const r2 = normalizePanelWidths(r1.layers, r1.editor, r1.preview, available2);
    expect(r2.layers + r2.editor + r2.preview).toBeLessThanOrEqual(available2);
    expect(r2.layers).toBeGreaterThanOrEqual(LAYERS_MIN);
    expect(r2.editor).toBeGreaterThanOrEqual(EDITOR_MIN);
    expect(r2.preview).toBeGreaterThanOrEqual(PREVIEW_MIN);
  });

  it('is idempotent when workspace width does not change', () => {
    const available = availableFromClientWidth(1100);
    const r1 = normalizePanelWidths(240, 420, 344, available);
    const r2 = normalizePanelWidths(r1.layers, r1.editor, r1.preview, available);
    expect(r2).toEqual(r1);
  });
});
