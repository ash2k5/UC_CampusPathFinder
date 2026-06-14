import { haversineDistance } from "./routing";
import type { RouteDestination, RoutePlan, ShortcutCollection } from "./types";

export type NodeId = number | string;

export interface GraphNode {
  lat: number;
  lon: number;
}

export interface Edge {
  neighborId: NodeId;
  distance: number;
}

export interface OsmNode {
  type: "node";
  id: NodeId;
  lat: number;
  lon: number;
}

export interface OsmWay {
  type: "way";
  id: NodeId;
  nodes?: NodeId[];
}

export type OsmElement = OsmNode | OsmWay;

export interface OsmData {
  elements: OsmElement[];
}

export type SpatialIndex = Map<string, NodeId[]>;

export interface BaseGraph {
  nodes: Map<NodeId, GraphNode>;
  edges: Map<NodeId, Edge[]>;
}

export interface RoutingGraph extends BaseGraph {
  syntheticToFeatureId: Map<NodeId, string>;
  index: SpatialIndex;
}

export interface OsmOverlayFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: Record<string, unknown>;
}

export interface OsmOverlay {
  type: "FeatureCollection";
  features: OsmOverlayFeature[];
}

interface HeapItem {
  id: NodeId;
  d: number;
}

interface AStarResult {
  coords: [number, number][];
  pathNodeIds: NodeId[];
  totalDistM: number;
}

// Min-heap priority queue. Ties on distance break by node id so the
// chosen path is deterministic regardless of heap insertion order.
class MinHeap {
  private h: HeapItem[] = [];
  get size() { return this.h.length; }
  push(item: HeapItem) { this.h.push(item); this._up(this.h.length - 1); }
  pop(): HeapItem {
    const top = this.h[0];
    const last = this.h.pop()!;
    if (this.h.length) { this.h[0] = last; this._down(0); }
    return top;
  }
  private _less(a: HeapItem, b: HeapItem) {
    if (a.d !== b.d) return a.d < b.d;
    return ("" + a.id) < ("" + b.id);
  }
  private _up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this._less(this.h[i], this.h[p])) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]]; i = p;
    }
  }
  private _down(i: number) {
    const n = this.h.length;
    while (true) {
      let s = i; const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._less(this.h[l], this.h[s])) s = l;
      if (r < n && this._less(this.h[r], this.h[s])) s = r;
      if (s === i) break;
      [this.h[s], this.h[i]] = [this.h[i], this.h[s]]; i = s;
    }
  }
}

function addEdge(edges: Map<NodeId, Edge[]>, from: NodeId, to: NodeId, dist: number) {
  if (!edges.has(from)) edges.set(from, []);
  edges.get(from)!.push({ neighborId: to, distance: dist });
}

// Parse Overpass JSON into a graph
export function buildBaseGraph(osmData: OsmData): BaseGraph {
  const nodes = new Map<NodeId, GraphNode>();
  const edges = new Map<NodeId, Edge[]>();

  for (const el of osmData.elements) {
    if (el.type === "node") nodes.set(el.id, { lat: el.lat, lon: el.lon });
  }

  for (const el of osmData.elements) {
    if (el.type !== "way" || !Array.isArray(el.nodes)) continue;
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

// FeatureCollection of LineStrings for every walkable OSM way (map overlay)
export function buildOsmOverlay(osmData: OsmData): OsmOverlay {
  const nodeMap = new Map<NodeId, [number, number]>();
  for (const el of osmData.elements) {
    if (el.type === "node") nodeMap.set(el.id, [el.lon, el.lat]);
  }
  const features: OsmOverlayFeature[] = [];
  for (const el of osmData.elements) {
    if (el.type !== "way" || !Array.isArray(el.nodes)) continue;
    const coords = el.nodes
      .map((id) => nodeMap.get(id))
      .filter((c): c is [number, number] => Boolean(c));
    if (coords.length >= 2) {
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
    }
  }
  return { type: "FeatureCollection", features };
}

const CELL_DEG = 0.003;

function cellIndex(deg: number) { return Math.floor(deg / CELL_DEG); }

// Bucket node ids into a lat/lon grid
export function buildSpatialIndex(nodes: Map<NodeId, GraphNode>): SpatialIndex {
  const grid = new Map<string, NodeId[]>();
  for (const [id, node] of nodes) {
    const key = `${cellIndex(node.lat)}:${cellIndex(node.lon)}`;
    let bucket = grid.get(key);
    if (!bucket) { bucket = []; grid.set(key, bucket); }
    bucket.push(id);
  }
  return grid;
}

// Node ids in grid cells covering radiusM around a point
function candidateIds(index: SpatialIndex, lat: number, lon: number, radiusM: number): NodeId[] {
  const mPerCellLat = CELL_DEG * 111320;
  const mPerCellLon = Math.max(mPerCellLat * Math.cos((lat * Math.PI) / 180), 1);
  const latReach = Math.ceil(radiusM / mPerCellLat) + 1;
  const lonReach = Math.ceil(radiusM / mPerCellLon) + 1;
  const ci = cellIndex(lat), cj = cellIndex(lon);
  const ids: NodeId[] = [];
  for (let i = ci - latReach; i <= ci + latReach; i++) {
    for (let j = cj - lonReach; j <= cj + lonReach; j++) {
      const bucket = index.get(`${i}:${j}`);
      if (bucket) for (const id of bucket) ids.push(id);
    }
  }
  return ids;
}

// Nearest node within maxDistM meters
export function findNearestNode(
  nodes: Map<NodeId, GraphNode>,
  lat: number,
  lon: number,
  maxDistM = 300,
  index: SpatialIndex | null = null,
): NodeId | null {
  const ids = index ? candidateIds(index, lat, lon, maxDistM) : nodes.keys();
  let bestId: NodeId | null = null, bestDist = Infinity;
  for (const id of ids) {
    const node = nodes.get(id);
    if (!node) continue;
    const d = haversineDistance(lat, lon, node.lat, node.lon);
    if (d < bestDist) { bestDist = d; bestId = id; }
  }
  return bestDist <= maxDistM ? bestId : null;
}

// Merge drawn shortcuts into the base graph
// Synthetic node ids: sc:featureId:index
export function buildRoutingGraph(baseGraph: BaseGraph, shortcuts: ShortcutCollection): RoutingGraph {
  // Deep-clone the base graph
  const nodes = new Map(baseGraph.nodes);
  const edges = new Map<NodeId, Edge[]>();
  for (const [id, neighbors] of baseGraph.edges) {
    edges.set(id, [...neighbors]);
  }

  const syntheticToFeatureId = new Map<NodeId, string>();
  const baseIndex = buildSpatialIndex(baseGraph.nodes);

  for (const feature of shortcuts.features) {
    const coords = feature.geometry?.coordinates; // [[lng, lat], ...]
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const ids = coords.map((_, i) => `sc:${feature.id}:${i}`);

    // Add synthetic nodes
    for (let i = 0; i < coords.length; i++) {
      nodes.set(ids[i], { lat: coords[i][1], lon: coords[i][0] });
      edges.set(ids[i], []);
      syntheticToFeatureId.set(ids[i], feature.id);
    }

    // Edges along the drawn path
    for (let i = 0; i < coords.length - 1; i++) {
      const a = nodes.get(ids[i])!, b = nodes.get(ids[i + 1])!;
      const dist = haversineDistance(a.lat, a.lon, b.lat, b.lon);
      addEdge(edges, ids[i], ids[i + 1], dist);
      addEdge(edges, ids[i + 1], ids[i], dist);
    }

    // Snap endpoints to up to 3 nearest base nodes within 500 m
    const endpoints: [NodeId, number, number][] = [
      [ids[0], coords[0][1], coords[0][0]],
      [ids[coords.length - 1], coords[coords.length - 1][1], coords[coords.length - 1][0]],
    ];
    for (const [synthId, epLat, epLon] of endpoints) {
      const nearby: { osmId: NodeId; d: number }[] = [];
      for (const osmId of candidateIds(baseIndex, epLat, epLon, 500)) {
        const osmNode = baseGraph.nodes.get(osmId);
        if (!osmNode) continue;
        const d = haversineDistance(epLat, epLon, osmNode.lat, osmNode.lon);
        if (d <= 500) nearby.push({ osmId, d });
      }
      nearby.sort((a, b) => a.d - b.d);
      for (const { osmId, d } of nearby.slice(0, 3)) {
        addEdge(edges, osmId, synthId, d);
        addEdge(edges, synthId, osmId, d);
      }
    }
  }

  const index = buildSpatialIndex(nodes);
  return { nodes, edges, syntheticToFeatureId, index };
}

// A* shortest path with haversine heuristic
export function runAStar(
  nodes: Map<NodeId, GraphNode>,
  edges: Map<NodeId, Edge[]>,
  startId: NodeId,
  endId: NodeId,
): AStarResult | null {
  const goal = nodes.get(endId);
  if (!goal) return null;
  const heuristic = (id: NodeId) => {
    const n = nodes.get(id)!;
    return haversineDistance(n.lat, n.lon, goal.lat, goal.lon);
  };

  const gScore = new Map<NodeId, number>([[startId, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const visited = new Set<NodeId>();
  const pq = new MinHeap();
  pq.push({ id: startId, d: heuristic(startId) });

  while (pq.size > 0) {
    const { id } = pq.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === endId) break;

    const g = gScore.get(id)!;
    for (const { neighborId, distance } of edges.get(id) || []) {
      if (visited.has(neighborId)) continue;
      const tentative = g + distance;
      if (!gScore.has(neighborId) || tentative < gScore.get(neighborId)!) {
        gScore.set(neighborId, tentative);
        prev.set(neighborId, id);
        pq.push({ id: neighborId, d: tentative + heuristic(neighborId) });
      }
    }
  }

  if (!prev.has(endId) && startId !== endId) return null;

  const pathNodeIds: NodeId[] = [];
  for (let cur: NodeId | undefined = endId; cur !== undefined; cur = prev.get(cur)) pathNodeIds.unshift(cur);

  const coords = pathNodeIds
    .map((id) => nodes.get(id))
    .filter((n): n is GraphNode => Boolean(n))
    .map((n) => [n.lon, n.lat] as [number, number]);

  return { coords, pathNodeIds, totalDistM: gScore.get(endId) ?? 0 };
}

const WALK_SPEED_MS = 1.4; // average walking pace

// Plan a walking route from a start point to a destination building,
// snapping to the destination entrance nearest the start. Returns
// { coords, usedShortcutIds, totalDistM, distanceMiles, durationMin } or
// { error: 'start-too-far' | 'dest-not-found' | 'no-route' }.
export function planRoute(
  graph: RoutingGraph,
  fromLat: number,
  fromLng: number,
  destination: RouteDestination,
): RoutePlan {
  let destLat = destination.lat, destLng = destination.lng;
  if (destination.entrances?.length) {
    let best: { lat: number; lng: number } | null = null, bestDist = Infinity;
    for (const e of destination.entrances) {
      const d = Math.hypot(e.lat - fromLat, e.lng - fromLng);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    if (best) { destLat = best.lat; destLng = best.lng; }
  }

  const startNodeId = findNearestNode(graph.nodes, fromLat, fromLng, 500, graph.index);
  if (!startNodeId) return { error: "start-too-far" };
  const endNodeId = findNearestNode(graph.nodes, destLat, destLng, 500, graph.index);
  if (!endNodeId) return { error: "dest-not-found" };

  const result = runAStar(graph.nodes, graph.edges, startNodeId, endNodeId);
  if (!result) return { error: "no-route" };

  const { coords, pathNodeIds, totalDistM } = result;

  const usedShortcutIds = new Set<string>();
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const fid1 = graph.syntheticToFeatureId.get(pathNodeIds[i]);
    const fid2 = graph.syntheticToFeatureId.get(pathNodeIds[i + 1]);
    if (fid1 && fid1 === fid2) usedShortcutIds.add(fid1);
  }

  return {
    coords,
    usedShortcutIds,
    totalDistM,
    distanceMiles: (totalDistM * 0.000621371).toFixed(2),
    durationMin: Math.ceil(totalDistM / WALK_SPEED_MS / 60),
  };
}
