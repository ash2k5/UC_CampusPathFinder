import { describe, it, expect } from 'vitest';
import { searchBuildings, UC_BUILDINGS } from '../app/buildings.js';

describe('searchBuildings', () => {
  it('returns nothing for queries shorter than two characters', () => {
    expect(searchBuildings('a')).toEqual([]);
    expect(searchBuildings('')).toEqual([]);
  });

  it('matches by name, case-insensitively', () => {
    const results = searchBuildings('LANGSAM');
    expect(results.some(b => b.name === 'Langsam Library')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    const results = searchBuildings('  langsam  ');
    expect(results.some(b => b.name === 'Langsam Library')).toBe(true);
  });

  it('matches by category', () => {
    const results = searchBuildings('parking');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(b => b.category === 'Parking')).toBe(true);
  });

  it('caps results at eight', () => {
    expect(searchBuildings('hall').length).toBeLessThanOrEqual(8);
  });

  it('exposes the building dataset', () => {
    expect(UC_BUILDINGS.length).toBeGreaterThan(50);
  });
});
