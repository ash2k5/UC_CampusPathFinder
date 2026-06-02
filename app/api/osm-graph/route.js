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

export async function GET() {
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

      // Keep only walkable ways + all nodes
      data.elements = data.elements.filter(el =>
        el.type === 'node' ||
        (el.type === 'way' && WALKABLE.has(el.tags?.highway))
      );

      return Response.json(data);
    } catch (err) {
      console.error(`${endpoint} failed:`, err.message);
    }
  }

  return Response.json({ error: 'All Overpass endpoints failed' }, { status: 503 });
}
