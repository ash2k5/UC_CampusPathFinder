const OSRM_ENDPOINTS = [
  'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  'https://router.project-osrm.org/route/v1/foot',
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const waypoints = searchParams.get('waypoints');

  if (!waypoints) {
    return Response.json({ error: 'Missing waypoints' }, { status: 400 });
  }

  // Count waypoints so we can set one radius per point (100m snap tolerance each)
  const waypointCount = waypoints.split(';').length;
  const radiuses = Array(waypointCount).fill('100').join(';');
  const query = `${waypoints}?overview=full&geometries=geojson&radiuses=${radiuses}`;

  for (const base of OSRM_ENDPOINTS) {
    const url = `${base}/${query}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { continue; }

      if (data.code === 'Ok' && data.routes?.length) {
        return Response.json(data);
      }
      console.warn(`OSRM (${base}): code=${data.code} message=${data.message}`);
    } catch (err) {
      console.warn(`OSRM fetch failed (${base}):`, err.message);
    }
  }

  return Response.json({ error: 'No route found — both routing servers failed' }, { status: 503 });
}
