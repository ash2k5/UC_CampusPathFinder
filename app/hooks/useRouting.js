'use client';

import { useState, useEffect, useRef } from 'react';
import { buildBaseGraph, buildRoutingGraph, buildOsmOverlay } from '../graph';

// Loads the OSM walk network, keeps the routing graph (OSM + shortcuts) in
// sync, and exposes the refs the map and getDirections read. The routing
// computation itself lives in graph.js (planRoute) so it stays testable.
export function useRouting(shortcuts) {
  const osmGraphRef = useRef(null);      // base OSM graph, built once
  const routingGraphRef = useRef(null);  // OSM + shortcuts, rebuilt on change
  const osmGeoJsonRef = useRef(null);    // walkable-ways overlay GeoJSON
  const shortcutsRef = useRef(shortcuts);

  const [graphStatus, setGraphStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);

  // Build the base graph and overlay once on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/osm-graph')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        osmGraphRef.current = buildBaseGraph(data);
        routingGraphRef.current = buildRoutingGraph(osmGraphRef.current, shortcutsRef.current);
        osmGeoJsonRef.current = buildOsmOverlay(data);
        setGraphStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Graph load failed:', err);
        setGraphStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  // Fold shortcuts into the routing graph whenever they change
  useEffect(() => {
    if (graphStatus !== 'ready' || !osmGraphRef.current) return;
    routingGraphRef.current = buildRoutingGraph(osmGraphRef.current, shortcuts);
  }, [shortcuts, graphStatus]);

  return { graphStatus, routingGraphRef, osmGeoJsonRef };
}
