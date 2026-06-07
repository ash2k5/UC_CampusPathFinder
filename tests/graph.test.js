import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../app/routing.js';
import { buildBaseGraph, findNearestNode, buildRoutingGraph, runAStar, buildSpatialIndex } from '../app/graph.js';

const sampleOsm = {
  elements: [
    { type: 'node', id: 1, lat: 39.1000, lon: -84.5000 },
    { type: 'node', id: 2, lat: 39.1010, lon: -84.5000 },
    { type: 'node', id: 3, lat: 39.1020, lon: -84.5000 },
    { type: 'way', id: 100, nodes: [1, 2, 3] },
  ],
};

describe('buildBaseGraph', () => {
  it('indexes every node', () => {
    const { nodes } = buildBaseGraph(sampleOsm);
    expect(nodes.size).toBe(3);
    expect(nodes.get(1)).toEqual({ lat: 39.1000, lon: -84.5000 });
  });

  it('creates bidirectional edges along ways', () => {
    const { edges } = buildBaseGraph(sampleOsm);
    expect(edges.get(1).map(e => e.neighborId)).toEqual([2]);
    expect(edges.get(2).map(e => e.neighborId).sort((a, b) => a - b)).toEqual([1, 3]);
    expect(edges.get(3).map(e => e.neighborId)).toEqual([2]);
  });

  it('weights edges by haversine distance', () => {
    const { edges } = buildBaseGraph(sampleOsm);
    const d = edges.get(1).find(e => e.neighborId === 2).distance;
    expect(d).toBeCloseTo(haversineDistance(39.1000, -84.5000, 39.1010, -84.5000), 6);
  });

  it('skips edges to missing nodes', () => {
    const broken = { elements: [
      { type: 'node', id: 1, lat: 39.1000, lon: -84.5000 },
      { type: 'way', id: 200, nodes: [1, 999] },
    ]};
    const { edges } = buildBaseGraph(broken);
    expect(edges.has(1)).toBe(false);
  });
});

describe('findNearestNode', () => {
  const nodes = new Map([
    [1, { lat: 39.1000, lon: -84.5000 }],
    [2, { lat: 39.2000, lon: -84.5000 }],
    [3, { lat: 39.1020, lon: -84.5000 }],
  ]);

  it('returns the closest node id', () => {
    expect(findNearestNode(nodes, 39.1003, -84.5000, 1000)).toBe(1);
  });

  it('returns null when nothing is within maxDist', () => {
    expect(findNearestNode(nodes, 39.1500, -84.5000, 100)).toBeNull();
  });

  it('finds a node only within range', () => {
    expect(findNearestNode(nodes, 39.1040, -84.5000, 100)).toBeNull();
    expect(findNearestNode(nodes, 39.1040, -84.5000, 300)).toBe(3);
  });
});

describe('buildSpatialIndex + indexed findNearestNode', () => {
  const nodes = new Map();
  let id = 0;
  for (let lat = 39.125; lat <= 39.140; lat += 0.001) {
    for (let lon = -84.525; lon <= -84.505; lon += 0.001) {
      nodes.set(++id, { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) });
    }
  }
  const index = buildSpatialIndex(nodes);

  it('buckets every node exactly once', () => {
    let count = 0;
    for (const bucket of index.values()) count += bucket.length;
    expect(count).toBe(nodes.size);
  });

  it('agrees with the linear scan on random queries', () => {
    for (let i = 0; i < 50; i++) {
      const lat = 39.125 + Math.random() * 0.015;
      const lon = -84.525 + Math.random() * 0.020;
      const linear = findNearestNode(nodes, lat, lon, 500);
      const indexed = findNearestNode(nodes, lat, lon, 500, index);
      expect(indexed == null).toBe(linear == null);
      if (linear != null) {
        const dl = haversineDistance(lat, lon, nodes.get(linear).lat, nodes.get(linear).lon);
        const di = haversineDistance(lat, lon, nodes.get(indexed).lat, nodes.get(indexed).lon);
        expect(di).toBeCloseTo(dl, 6);
      }
    }
  });

  it('returns null beyond maxDist using the index', () => {
    expect(findNearestNode(nodes, 40.0, -85.0, 500, index)).toBeNull();
  });
});

describe('buildRoutingGraph', () => {
  const base = buildBaseGraph(sampleOsm);

  it('returns an isolated clone when there are no shortcuts', () => {
    const g = buildRoutingGraph(base, { type: 'FeatureCollection', features: [] });
    expect(g.nodes.size).toBe(base.nodes.size);
    expect(g.syntheticToFeatureId.size).toBe(0);
    expect(g.index).toBeInstanceOf(Map);
    g.nodes.set('x', { lat: 0, lon: 0 });
    expect(base.nodes.has('x')).toBe(false);
  });

  it('adds synthetic nodes, path edges, and snaps endpoints to base nodes', () => {
    const shortcuts = { type: 'FeatureCollection', features: [
      { id: 'f1', geometry: { type: 'LineString', coordinates: [
        [-84.5000, 39.1002], [-84.5000, 39.1008],
      ] } },
    ]};
    const g = buildRoutingGraph(base, shortcuts);
    expect(g.nodes.has('sc:f1:0')).toBe(true);
    expect(g.nodes.has('sc:f1:1')).toBe(true);
    expect(g.syntheticToFeatureId.get('sc:f1:0')).toBe('f1');
    expect(g.edges.get('sc:f1:0').some(e => e.neighborId === 'sc:f1:1')).toBe(true);
    const snappedToBase = g.edges.get('sc:f1:0').some(e => e.neighborId === 1 || e.neighborId === 2);
    expect(snappedToBase).toBe(true);
  });
});

describe('runAStar', () => {
  const nodes = new Map([
    [1, { lat: 39.1000, lon: -84.5000 }],
    [2, { lat: 39.1010, lon: -84.5000 }],
    [3, { lat: 39.1020, lon: -84.5000 }],
  ]);
  const edges = new Map([
    [1, [{ neighborId: 2, distance: 10 }]],
    [2, [{ neighborId: 1, distance: 10 }, { neighborId: 3, distance: 10 }]],
    [3, [{ neighborId: 2, distance: 10 }]],
  ]);

  it('finds the shortest path on a linear graph', () => {
    const r = runAStar(nodes, edges, 1, 3);
    expect(r.pathNodeIds).toEqual([1, 2, 3]);
    expect(r.totalDistM).toBe(20);
    expect(r.coords).toEqual([[-84.5000, 39.1000], [-84.5000, 39.1010], [-84.5000, 39.1020]]);
  });

  it('returns a zero-length path when start equals end', () => {
    const r = runAStar(nodes, edges, 2, 2);
    expect(r.pathNodeIds).toEqual([2]);
    expect(r.totalDistM).toBe(0);
  });

  it('returns null when no path exists', () => {
    const ns = new Map([[1, { lat: 0, lon: 0 }], [2, { lat: 1, lon: 1 }]]);
    const es = new Map([[1, []], [2, []]]);
    expect(runAStar(ns, es, 1, 2)).toBeNull();
  });

  it('prefers the cheaper of two routes', () => {
    const ns = new Map([
      [1, { lat: 0, lon: 0 }],
      [2, { lat: 0, lon: 0.001 }],
      [3, { lat: 0, lon: 0.0005 }],
    ]);
    const es = new Map([
      [1, [{ neighborId: 2, distance: 100 }, { neighborId: 3, distance: 10 }]],
      [3, [{ neighborId: 2, distance: 10 }, { neighborId: 1, distance: 10 }]],
      [2, [{ neighborId: 1, distance: 100 }, { neighborId: 3, distance: 10 }]],
    ]);
    const r = runAStar(ns, es, 1, 2);
    expect(r.totalDistM).toBe(20);
    expect(r.pathNodeIds).toEqual([1, 3, 2]);
  });
});

describe('graph robustness', () => {
  it('buildBaseGraph skips ways with missing or non-array nodes', () => {
    const data = { elements: [
      { type: 'node', id: 1, lat: 39.1, lon: -84.5 },
      { type: 'way', id: 5 },              // no nodes property
      { type: 'way', id: 6, nodes: [1] },  // single node, no edge
    ]};
    const { nodes, edges } = buildBaseGraph(data);
    expect(nodes.size).toBe(1);
    expect(edges.size).toBe(0);
  });

  it('buildRoutingGraph skips degenerate shortcuts', () => {
    const base = buildBaseGraph(sampleOsm);
    const shortcuts = { type: 'FeatureCollection', features: [
      { id: 'empty', geometry: { type: 'LineString', coordinates: [] } },
      { id: 'single', geometry: { type: 'LineString', coordinates: [[-84.5, 39.1]] } },
      { id: 'noGeom' },
    ]};
    const g = buildRoutingGraph(base, shortcuts);
    expect(g.syntheticToFeatureId.size).toBe(0);
    expect(g.nodes.size).toBe(base.nodes.size);
  });
});
