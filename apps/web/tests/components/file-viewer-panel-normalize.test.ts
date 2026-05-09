// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { normalizePanelWidths } from '../../src/components/FileViewer';

const LAYERS_MIN = 180;
const EDITOR_MIN = 280;
const PREVIEW_MIN = 280;
const SUM_OF_MINS = LAYERS_MIN + EDITOR_MIN + PREVIEW_MIN; // 740

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
    expect(r.preview).toBe(290); // absorbs remaining 110 overflow
    expect(r.layers + r.editor + r.preview).toBe(SUM_OF_MINS + 10);
  });

  it('handles large-monitor widths restored on a smaller split workspace', () => {
    // Saved on a 2560px monitor: layers=400, editor=600, preview=500
    // Opened on a split workspace: 850px clientWidth - 56 = 794 available
    const available = 794;
    const r = normalizePanelWidths(400, 600, 500, available);

    // sum = 1500, overflow = 706
    // editor squeezed: 600 -> 280 (320), overflow = 386
    // layers squeezed: 400 -> 180 (220), overflow = 166
    // preview squeezed: 500 -> 334 (166)
    expect(r.editor).toBe(EDITOR_MIN);
    expect(r.layers).toBe(LAYERS_MIN);
    expect(r.preview).toBe(334);
    expect(r.layers + r.editor + r.preview).toBe(794);
  });

  it('handles a single oversized panel on an otherwise normal workspace', () => {
    // layers=800 on a 900px clientWidth workspace: 900 - 56 = 844 available
    const r = normalizePanelWidths(800, 420, 344, 844);

    // sum = 1564, overflow = 720
    // editor: 420 -> 280 (140), overflow = 580
    // layers: 800 -> 220 (580), overflow = 0
    expect(r.editor).toBe(EDITOR_MIN);
    expect(r.preview).toBe(344);
    expect(r.layers).toBe(220);
    expect(r.layers + r.editor + r.preview).toBe(844);
  });

  it('rounds fractional panel widths', () => {
    const r = normalizePanelWidths(240.7, 420.3, 344.5, 1200);
    expect(r.layers).toBe(241);
    expect(r.editor).toBe(420);
    expect(r.preview).toBe(345);
  });

  it('returns minimums when available is less than sum of minimums', () => {
    // Pathological: workspace too narrow even for minimums
    const r = normalizePanelWidths(200, 300, 300, SUM_OF_MINS - 1);
    expect(r.layers).toBe(LAYERS_MIN);
    expect(r.editor).toBe(EDITOR_MIN);
    expect(r.preview).toBe(PREVIEW_MIN);
  });
});
