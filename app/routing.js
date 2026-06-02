/**
 * Haversine distance between two lat/lng points, in meters.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Total walked length of a GeoJSON LineString feature, in meters.
 */
function pathLength(feature) {
  const coords = feature.geometry.coordinates;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(
      coords[i - 1][1], coords[i - 1][0],
      coords[i][1],     coords[i][0]
    );
  }
  return total;
}

/**
 * Find the best shortcut to inject as a routing waypoint.
 *
 * Strategy:
 *   For each drawn shortcut we try both traversal directions:
 *     entry → [walk shortcut] → exit
 *   We estimate the total trip length as:
 *     haversine(start → entry) + pathLength(shortcut) + haversine(exit → dest)
 *   and compare it to the straight-line baseline haversine(start → dest).
 *
 *   A shortcut is used if it saves at least MIN_SAVING_M metres AND the
 *   detour to reach its entry point is not more than MAX_DETOUR_RATIO × baseline
 *   (so we don't route someone way off course to reach a shortcut).
 *
 *   Among all qualifying shortcuts, the one with the greatest estimated saving
 *   is chosen.
 *
 * @param {object} shortcuts  GeoJSON FeatureCollection of drawn shortcuts
 * @param {number} userLat
 * @param {number} userLng
 * @param {number} destLat
 * @param {number} destLng
 * @returns {{ feature, entryPoint: [lng,lat], exitPoint: [lng,lat], savingM: number } | null}
 */
export function findBestShortcut(shortcuts, userLat, userLng, destLat, destLng) {
  const MIN_SAVING_M   = 20;   // shortcut must save at least this many metres
  const MAX_DETOUR_RATIO = 1.4; // entry point must be reachable within 1.4× baseline distance

  const baseline = haversineDistance(userLat, userLng, destLat, destLng);
  const candidates = [];

  for (const feature of shortcuts.features) {
    const coords  = feature.geometry.coordinates; // [[lng, lat], ...]
    const length  = pathLength(feature);

    // Try the shortcut in both traversal directions
    const directions = [
      { entryPoint: coords[0],                exitPoint: coords[coords.length - 1] },
      { entryPoint: coords[coords.length - 1], exitPoint: coords[0] },
    ];

    for (const { entryPoint, exitPoint } of directions) {
      const distToEntry  = haversineDistance(userLat,       userLng,       entryPoint[1], entryPoint[0]);
      const distFromExit = haversineDistance(exitPoint[1],  exitPoint[0],  destLat,       destLng);
      const estimated    = distToEntry + length + distFromExit;
      const saving       = baseline - estimated;

      // Must genuinely save distance and not require a huge detour to reach
      if (saving >= MIN_SAVING_M && distToEntry <= baseline * MAX_DETOUR_RATIO) {
        candidates.push({ feature, entryPoint, exitPoint, saving, estimated });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick the shortcut with the greatest estimated saving
  candidates.sort((a, b) => b.saving - a.saving);
  const { feature, entryPoint, exitPoint, saving } = candidates[0];
  return { feature, entryPoint, exitPoint, savingM: Math.round(saving) };
}
