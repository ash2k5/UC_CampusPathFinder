import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../src/lib/routing';

describe('haversineDistance', () => {
  it('is zero for identical points', () => {
    expect(haversineDistance(39.131, -84.515, 39.131, -84.515)).toBe(0);
  });

  it('matches one degree of latitude', () => {
    expect(haversineDistance(0, 0, 1, 0)).toBeCloseTo(111194.9, 0);
  });

  it('is symmetric', () => {
    const a = haversineDistance(39.13, -84.52, 39.14, -84.50);
    const b = haversineDistance(39.14, -84.50, 39.13, -84.52);
    expect(a).toBeCloseTo(b, 6);
  });

  it('returns a positive distance for distinct points', () => {
    expect(haversineDistance(39.1338, -84.5157, 39.1315, -84.5175)).toBeGreaterThan(0);
  });
});
