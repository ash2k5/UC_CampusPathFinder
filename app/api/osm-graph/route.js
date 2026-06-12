// Fetches walkable OSM ways for the UC campus area from Overpass API.
// Proxied server-side to avoid CORS restrictions.

const BBOX = '39.122,-84.528,39.142,-84.502';
const QUERY = `[out:json][timeout:25];way["highway"](${BBOX});(._;>;);out body;`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

const WALKABLE = new Set([
  'footway', 'path', 'pedestrian', 'steps', 'living_street',
  'residential', 'service', 'tertiary', 'secondary', 'primary',
  'unclassified', 'cycleway', 'track', 'corridor',
]);

// The campus walk network is effectively static, so cache the
// filtered response and avoid hammering the rate-limited Overpass API.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache = { at: 0, data: null };

// Let Vercel's edge cache the static walk network across serverless instances.
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' };

export async function GET() {
  if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) {
    return Response.json(cache.data, { headers: CACHE_HEADERS });
  }

  for (const endpoint of ENDPOINTS) {
    try {
      const body = `data=${encodeURIComponent(QUERY)}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*',
          'User-Agent': 'CampusPathFinder/1.0',
        },
        body,
        signal: AbortSignal.timeout(28000),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`${endpoint} returned ${res.status}:`, text.slice(0, 300));
        continue;
      }

      const data = await res.json();
      if (!Array.isArray(data.elements)) {
        console.error(`${endpoint} returned an unexpected payload`);
        continue;
      }

      // Keep all nodes + walkable ways that carry a node list
      data.elements = data.elements.filter(el =>
        el.type === 'node' ||
        (el.type === 'way' && Array.isArray(el.nodes) && WALKABLE.has(el.tags?.highway))
      );

      cache = { at: Date.now(), data };
      return Response.json(data, { headers: CACHE_HEADERS });
    } catch (err) {
      console.error(`${endpoint} failed:`, err.message);
    }
  }

  return Response.json({ error: 'All Overpass endpoints failed' }, { status: 503 });
}
