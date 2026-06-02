import { haversineDistance } from './routing';

// ---------------------------------------------------------------------------
// Min-heap priority queue for Dijkstra
// ---------------------------------------------------------------------------
class MinHeap {
  constructor() { this.h = []; }
  get size() { return this.h.length; }
  push(item) { this.h.push(item); this._up(this.h.length - 1); }
  pop() {
    const top = this.h[0];
    const last = this.h.pop();
    if (this.h.length) { this.h[0] = last; this._down(0); }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p].d <= this.h[i].d) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]]; i = p;
    }
  }
  _down(i) {
    const n = this.h.length;
    while (true) {
      let s = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.h[l].d < this.h[s].d) s = l;
      if (r < n && this.h[r].d < this.h[s].d) s = r;
      if (s === i) break;
      [this.h[s], this.h[i]] = [this.h[i], this.h[s]]; i = s;
    }
  }
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------
function addEdge(edges, from, to, dist) {
  if (!edges.has(from)) edges.set(from, []);
  edges.get(from).push({ neighborId: to, distance: dist });
}

/**
 * Parse raw Overpass JSON into { nodes: Map, edges: Map }.
 * nodes: id → { lat, lon }
 * edges: id → [{ neighborId, distance }]
 */
export function buildBaseGraph(osmData) {
  const nodes = new Map();
  const edges = new Map();

  for (const el of osmData.elements) {
    if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lon: el.lon });
  }

  for (const el of osmData.elements) {
    if (el.type !== 'way') continue;
    for (let i = 0; i < el.nodes.length - 1; i++) {
      const aId = el.nodes[i], bId = el.nodes[i + 1];
      const a = nodes.get(aId), b = nodes.get(bId);
      if (!a || !b) continue;
      const dist = haversineDistance(a.lat, a.lon, b.lat, b.lon);
      addEdge(edges, aId, bId, dist);
      addEdge(edges, bId, aId, dist);
    }
  }

  return { nodes, edges };
}

/**
 * Find the nearest node in `nodes` to (lat, lon).
 * Returns null if nothing is within maxDistM metres.
 */
export function findNearestNode(nodes, lat, lon, maxDistM = 300) {
  let bestId = null, bestDist = Infinity;
  for (const [id, node] of nodes) {
    const d = haversineDistance(lat, lon, node.lat, node.lon);
    if (d < bestDist) { bestDist = d; bestId = id; }
  }
  return bestDist <= maxDistM ? bestId : null;
}

/**
 * Build a combined routing graph by cloning the base OSM graph and adding
 * custom shortcut paths as additional edges.
 *
 * Synthetic node IDs use the format  `sc:${featureId}:${index}`
 * so they can be traced back to the originating feature.
 *
 * Each shortcut's first and last points are snapped (connected by an edge)
 * to the nearest OSM node within 200 m so the router can enter/exit them.
 *
 * Returns { nodes, edges, syntheticToFeatureId }
 */
export function buildRoutingGraph(baseGraph, shortcuts) {
  // Deep-clone the base graph
  const nodes = new Map(baseGraph.nodes);
  const edges = new Map();
  for (const [id, neighbors] of baseGraph.edges) {
    edges.set(id, [...neighbors]);
  }

  const syntheticToFeatureId = new Map();

  for (const feature of shortcuts.features) {
    const coords = feature.geometry.coordinates; // [[lng, lat], ...]
    const ids = coords.map((_, i) => `sc:${feature.id}:${i}`);

    // Add synthetic nodes
    for (let i = 0; i < coords.length; i++) {
      nodes.set(ids[i], { lat: coords[i][1], lon: coords[i][0] });
      edges.set(ids[i], []);
      syntheticToFeatureId.set(ids[i], feature.id);
    }

    // Edges along the drawn path
    for (let i = 0; i < coords.length - 1; i++) {
      const a = nodes.get(ids[i]), b = nodes.get(ids[i + 1]);
      const dist = haversineDistance(a.lat, a.lon, b.lat, b.lon);
      addEdge(edges, ids[i], ids[i + 1], dist);
      addEdge(edges, ids[i + 1], ids[i], dist);
    }

    // Snap both endpoints to the nearest OSM nodes (up to 3) within 500 m
    for (const [synthId, epLat, epLon] of [
      [ids[0],               coords[0][1],               coords[0][0]],
      [ids[coords.length-1], coords[coords.length-1][1], coords[coords.length-1][0]],
    ]) {
      const nearby = [];
      for (const [osmId, osmNode] of baseGraph.nodes) {
        const d = haversineDistance(epLat, epLon, osmNode.lat, osmNode.lon);
        if (d <= 500) nearby.push({ osmId, d });
      }
      nearby.sort((a, b) => a.d - b.d);
      for (const { osmId, d } of nearby.slice(0, 3)) {
        addEdge(edges, osmId,   synthId, d);
        addEdge(edges, synthId, osmId,   d);
      }
    }
  }

  return { nodes, edges, syntheticToFeatureId };
}

/**
 * Dijkstra shortest path.
 * Returns { coords: [[lng,lat],...], pathNodeIds: [...], totalDistM: number }
 * or null if no path exists.
 */
export function runDijkstra(nodes, edges, startId, endId) {
  const dist = new Map([[startId, 0]]);
  const prev = new Map();
  const visited = new Set();
  const pq = new MinHeap();
  pq.push({ id: startId, d: 0 });

  while (pq.size > 0) {
    const { id, d } = pq.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === endId) break;

    for (const { neighborId, distance } of (edges.get(id) || [])) {
      if (visited.has(neighborId)) continue;
      const nd = d + distance;
      if (!dist.has(neighborId) || nd < dist.get(neighborId)) {
        dist.set(neighborId, nd);
        prev.set(neighborId, id);
        pq.push({ id: neighborId, d: nd });
      }
    }
  }

  if (!prev.has(endId) && startId !== endId) return null;

  const pathNodeIds = [];
  for (let cur = endId; cur !== undefined; cur = prev.get(cur)) pathNodeIds.unshift(cur);

  const coords = pathNodeIds
    .map(id => nodes.get(id))
    .filter(Boolean)
    .map(n => [n.lon, n.lat]);

  return { coords, pathNodeIds, totalDistM: dist.get(endId) ?? 0 };
}
