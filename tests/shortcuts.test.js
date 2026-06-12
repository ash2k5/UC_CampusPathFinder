import { describe, it, expect, vi, afterEach } from 'vitest';
import { shortcutFeatures } from '../app/hooks/useShortcuts.js';

// Minimal stand-in for a Firestore QueryDocumentSnapshot
const docOf = (id, data) => ({ id, data: () => data });

const lineString = { type: 'LineString', coordinates: [[-84.51, 39.13], [-84.5, 39.14]] };

describe('shortcutFeatures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps valid docs to GeoJSON features and exposes the id', () => {
    const fc = shortcutFeatures([
      docOf('a', { geometry: JSON.stringify(lineString), properties: { creator: 'u1' } }),
    ]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]).toMatchObject({
      type: 'Feature',
      id: 'a',
      geometry: lineString,
      properties: { creator: 'u1', _id: 'a' },
    });
  });

  it('skips a doc whose geometry is invalid JSON and keeps the valid ones', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fc = shortcutFeatures([
      docOf('good', { geometry: JSON.stringify(lineString), properties: {} }),
      docOf('bad', { geometry: '{not valid json', properties: {} }),
      docOf('also-good', { geometry: JSON.stringify(lineString), properties: {} }),
    ]);
    expect(fc.features.map(f => f.id)).toEqual(['good', 'also-good']);
    expect(console.error).toHaveBeenCalledWith('Skipping shortcut with invalid geometry:', 'bad');
  });

  it('skips a doc with a missing geometry field', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fc = shortcutFeatures([docOf('empty', { properties: {} })]);
    expect(fc.features).toHaveLength(0);
  });

  it('returns an empty collection for no docs', () => {
    expect(shortcutFeatures([])).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
