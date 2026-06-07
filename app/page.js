"use client";

import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, APP_ID } from './lib/firebase';
import { CAMPUS_CENTER, MAP_STYLE, EMPTY_GEOJSON } from './lib/constants';
import { searchBuildings, UC_BUILDINGS } from './buildings';
import { buildBaseGraph, buildRoutingGraph, findNearestNode, runAStar } from './graph';
import { useAuth } from './hooks/useAuth';
import { useShortcuts } from './hooks/useShortcuts';
import Toast from './components/Toast';
import SearchHeader from './components/SearchHeader';
import DirectionsPanel from './components/DirectionsPanel';
import AdminPanel from './components/AdminPanel';
import LoginScreen from './components/LoginScreen';
import LoadingScreen from './components/LoadingScreen';

import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

export default function Page() {
  const { user, isAdmin, authStage, logout } = useAuth();
  const shortcuts = useShortcuts(user);

  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const markerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const maplibreRef = useRef(null);

  // Refs avoid stale closures
  const userRef = useRef(null);
  const isAdminRef = useRef(false);
  const shortcutsRef = useRef(EMPTY_GEOJSON);

  // Routing graph refs
  const osmGraphRef = useRef(null);      // base OSM graph (built once on load)
  const routingGraphRef = useRef(null);  // OSM + custom shortcuts (rebuilt when shortcuts change)
  const osmGeoJsonRef = useRef(null);    // raw GeoJSON of OSM walkable ways (for overlay)
  const pathClickConsumedRef = useRef(false);
  const lastDrawCreateRef = useRef(0);
  const selectedPathIdRef = useRef(null);
  const selectBuildingRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [graphStatus, setGraphStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  const [destination, setDestination] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null); // { distance, duration, shortcutUsed }
  const [usedShortcutIds, setUsedShortcutIds] = useState(new Set());

  const [startQuery, setStartQuery] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [startLocation, setStartLocation] = useState(null); // null = use GPS

  const [showOsmPaths, setShowOsmPaths] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type: 'success' | 'error' }

  // Keep refs in sync with state
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);
  useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);
  useEffect(() => { selectedPathIdRef.current = selectedPathId; }, [selectedPathId]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // Backspace / Delete key to remove selected path
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const pathId = selectedPathIdRef.current;
      if (!pathId || !isAdminRef.current || !db) return;
      setIsDeleting(true);
      deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shortcuts', pathId))
        .then(() => { setSelectedPathId(null); setToast({ msg: 'Path deleted', type: 'success' }); })
        .catch(() => setToast({ msg: 'Delete failed — check Firestore rules', type: 'error' }))
        .finally(() => setIsDeleting(false));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load OSM walkable graph for campus (once on mount)
  useEffect(() => {
    fetch('/api/osm-graph')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        osmGraphRef.current = buildBaseGraph(data);
        routingGraphRef.current = buildRoutingGraph(osmGraphRef.current, shortcutsRef.current);

        // Build GeoJSON overlay of all walkable OSM ways
        const nodeMap = new Map();
        for (const el of data.elements) {
          if (el.type === 'node') nodeMap.set(el.id, [el.lon, el.lat]);
        }
        const features = [];
        for (const el of data.elements) {
          if (el.type !== 'way') continue;
          const coords = el.nodes.map(id => nodeMap.get(id)).filter(Boolean);
          if (coords.length >= 2) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
        }
        osmGeoJsonRef.current = { type: 'FeatureCollection', features };
        if (map.current?.getSource('osm-paths-source')) {
          map.current.getSource('osm-paths-source').setData(osmGeoJsonRef.current);
        }

        setGraphStatus('ready');
      })
      .catch(err => {
        console.error('Graph load failed:', err);
        setGraphStatus('error');
      });
  }, []);

  // Rebuild routing graph whenever shortcuts change (after base graph is ready)
  useEffect(() => {
    if (graphStatus !== 'ready' || !osmGraphRef.current) return;
    routingGraphRef.current = buildRoutingGraph(osmGraphRef.current, shortcuts);
  }, [shortcuts, graphStatus]);

  // Map initialization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const init = async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default;
      if (cancelled || map.current || !mapContainer.current) return;
      maplibreRef.current = maplibregl;

      map.current = new maplibregl.Map({
        container: mapContainer.current, style: MAP_STYLE, center: CAMPUS_CENTER, zoom: 15,
      });
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { line_string: true, trash: true },
        defaultMode: 'simple_select'
      });

      map.current.on('load', () => {
        setIsMapLoaded(true);

        // OSM walkable paths overlay (admin reference layer)
        map.current.addSource('osm-paths-source', { type: 'geojson', data: osmGeoJsonRef.current || EMPTY_GEOJSON });
        map.current.addLayer({
          id: 'osm-paths-layer', type: 'line', source: 'osm-paths-source',
          layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
          paint: { 'line-color': '#6366f1', 'line-width': 2, 'line-opacity': 0.7 }
        });

        // Shortcuts layer (green dashed)
        map.current.addSource('shortcuts-source', { type: 'geojson', data: EMPTY_GEOJSON });
        map.current.addLayer({
          id: 'shortcuts-layer', type: 'line', source: 'shortcuts-source',
          layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
          paint: { 'line-color': '#22c55e', 'line-width': 6, 'line-dasharray': [2, 1] }
        });

        // Selected path highlight (red, admin delete mode)
        map.current.addSource('selected-source', { type: 'geojson', data: EMPTY_GEOJSON });
        map.current.addLayer({
          id: 'selected-layer', type: 'line', source: 'selected-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ef4444', 'line-width': 8, 'line-opacity': 0.9 }
        });

        // Active shortcut highlight (amber, currently used for routing)
        map.current.addSource('active-shortcut-source', { type: 'geojson', data: EMPTY_GEOJSON });
        map.current.addLayer({
          id: 'active-shortcut-layer', type: 'line', source: 'active-shortcut-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#f59e0b', 'line-width': 8, 'line-opacity': 1 }
        });

        // Building markers
        const buildingFeatures = UC_BUILDINGS.map(b => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
          properties: { name: b.name, category: b.category }
        }));
        map.current.addSource('buildings-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: buildingFeatures }
        });
        map.current.addLayer({
          id: 'buildings-circle', type: 'circle', source: 'buildings-source',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 17, 11],
            'circle-color': [
              'match', ['get', 'category'],
              'Academic',          '#3b82f6',
              'Arts & Performance','#a855f7',
              'Medical',           '#ef4444',
              'Library',           '#f59e0b',
              'Student Life',      '#10b981',
              'Recreation',        '#f97316',
              'Dining',            '#ec4899',
              'Housing',           '#84cc16',
              'Parking',           '#6b7280',
              '#3b82f6'
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          }
        });
        map.current.addLayer({
          id: 'buildings-label', type: 'symbol', source: 'buildings-source',
          minzoom: 16,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
            'text-max-width': 10,
          },
          paint: {
            'text-color': '#1e293b',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          }
        });

        map.current.on('click', 'buildings-circle', (e) => {
          pathClickConsumedRef.current = true;
          const props = e.features[0]?.properties;
          if (!props) return;
          const building = UC_BUILDINGS.find(b => b.name === props.name);
          if (building) selectBuildingRef.current?.(building);
        });
        map.current.on('mouseenter', 'buildings-circle', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'buildings-circle', () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Route layer (blue)
        map.current.addSource('route-source', { type: 'geojson', data: EMPTY_GEOJSON });
        map.current.addLayer({
          id: 'route-layer', type: 'line', source: 'route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.85 }
        });

        // Autosave when a path is finished drawing
        map.current.on('draw.create', async (e) => {
          const feature = e.features[0];
          const currentUser = userRef.current;
          if (!currentUser || !db) return;
          lastDrawCreateRef.current = Date.now();

          const shortcutId = `path_${Date.now()}`;
          try {
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shortcuts', shortcutId), {
              geometry: JSON.stringify(feature.geometry),
              properties: { creator: currentUser.uid, timestamp: new Date().toISOString() }
            });
            draw.current.deleteAll();
            setIsDrawing(false);
            showToast('Path saved');
          } catch (err) {
            console.error('Autosave failed:', err);
            showToast('Save failed', 'error');
          }
        });

        // Click shortcut path to select it (admin only)
        map.current.on('click', 'shortcuts-layer', (e) => {
          if (!isAdminRef.current) return;
          // ignore finish click
          if (Date.now() - lastDrawCreateRef.current < 700) return;
          pathClickConsumedRef.current = true;
          const id = e.features[0]?.properties?._id;
          if (!id) return;
          setSelectedPathId(prev => prev === id ? null : id);
        });

        // Cursor pointer over paths in admin mode
        map.current.on('mouseenter', 'shortcuts-layer', () => {
          if (isAdminRef.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'shortcuts-layer', () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Click map (not on a path) to deselect
        map.current.on('click', () => {
          if (!isAdminRef.current) return;
          if (pathClickConsumedRef.current) { pathClickConsumedRef.current = false; return; }
          setSelectedPathId(null);
        });
      });

      map.current.on('draw.modechange', (e) => setIsDrawing(e.mode === 'draw_line_string'));
    };

    init().catch(err => console.error('Map init failed:', err));
    return () => { cancelled = true; };
  }, []);

  // Sync shortcuts to map
  useEffect(() => {
    if (isMapLoaded && map.current?.getSource('shortcuts-source')) {
      map.current.getSource('shortcuts-source').setData(shortcuts);
    }
  }, [shortcuts, isMapLoaded]);

  // Sync OSM paths overlay visibility
  useEffect(() => {
    if (!isMapLoaded || !map.current?.getLayer('osm-paths-layer')) return;
    map.current.setLayoutProperty('osm-paths-layer', 'visibility', showOsmPaths ? 'visible' : 'none');
  }, [showOsmPaths, isMapLoaded]);

  // Show green paths only in admin mode or while drawing
  useEffect(() => {
    if (!isMapLoaded || !map.current?.getLayer('shortcuts-layer')) return;
    const visible = isAdmin || isDrawing;
    map.current.setLayoutProperty('shortcuts-layer', 'visibility', visible ? 'visible' : 'none');
  }, [isAdmin, isDrawing, isMapLoaded]);

  // Highlight shortcuts used by the route
  useEffect(() => {
    if (!isMapLoaded || !map.current?.getSource('active-shortcut-source')) return;
    const features = shortcuts.features.filter(f => usedShortcutIds.has(f.id));
    map.current.getSource('active-shortcut-source').setData({ type: 'FeatureCollection', features });
  }, [usedShortcutIds, shortcuts, isMapLoaded]);

  // Sync selected path highlight to map
  useEffect(() => {
    if (!isMapLoaded || !map.current?.getSource('selected-source')) return;
    if (!selectedPathId) {
      map.current.getSource('selected-source').setData(EMPTY_GEOJSON);
      return;
    }
    const feature = shortcuts.features.find(f => f.id === selectedPathId);
    if (feature) {
      map.current.getSource('selected-source').setData({ type: 'FeatureCollection', features: [feature] });
    }
  }, [selectedPathId, shortcuts, isMapLoaded]);

  // Admin draw controls, deselect when leaving admin mode
  useEffect(() => {
    if (!isMapLoaded || !map.current || !draw.current) return;
    if (isAdmin) {
      map.current.addControl(draw.current, 'top-left');
    } else {
      setIsDrawing(false);
      setSelectedPathId(null);
      if (map.current.hasControl(draw.current)) map.current.removeControl(draw.current);
    }
  }, [isAdmin, isMapLoaded]);

  // Search
  const handleSearchInput = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchResults(searchBuildings(q));
  };

  const handleSelectResult = (result) => {
    setSearchQuery(result.name);
    setSearchResults([]);
    setDestination(result);
    setRouteInfo(null);
    if (map.current?.getSource('route-source')) {
      map.current.getSource('route-source').setData(EMPTY_GEOJSON);
    }
    if (markerRef.current) markerRef.current.remove();
    if (map.current) {
      markerRef.current = new maplibreRef.current.Marker({ color: '#2563eb' })
        .setLngLat([result.lng, result.lat])
        .addTo(map.current);
      map.current.flyTo({ center: [result.lng, result.lat], zoom: 17, duration: 1000 });
    }
  };

  const clearDestination = () => {
    setDestination(null);
    setRouteInfo(null);
    setUsedShortcutIds(new Set());
    setSearchQuery('');
    setStartQuery('');
    setStartResults([]);
    setStartLocation(null);
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
    if (map.current?.getSource('route-source')) {
      map.current.getSource('route-source').setData(EMPTY_GEOJSON);
    }
  };

  const handleStartInput = (e) => {
    const q = e.target.value;
    setStartQuery(q);
    setStartLocation(null);
    setStartResults(q.trim().length >= 2 ? searchBuildings(q) : []);
  };

  const handleSelectStart = (building) => {
    setStartLocation(building);
    setStartQuery(building.name);
    setStartResults([]);
  };

  const clearStart = () => {
    setStartLocation(null);
    setStartQuery('');
    setStartResults([]);
  };

  const getDirections = async () => {
    if (!destination || !map.current) return;
    setIsRouting(true);
    setUsedShortcutIds(new Set());

    try {
      // Resolve start position
      let fromLng, fromLat;

      if (startLocation) {
        fromLng = startLocation.lng;
        fromLat = startLocation.lat;
      } else {
        if (!navigator.geolocation) {
          showToast('Enable location or choose a start building', 'error');
          return;
        }
        const position = await Promise.race([
          new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 8000, maximumAge: 60000, enableHighAccuracy: false,
            })
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('location-timeout')), 10000)
          ),
        ]);
        fromLng = position.coords.longitude;
        fromLat = position.coords.latitude;
      }

      // Place start marker
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = new maplibreRef.current.Marker({ color: '#16a34a' })
        .setLngLat([fromLng, fromLat])
        .addTo(map.current);

      // Ensure graph is ready
      const graph = routingGraphRef.current;
      if (!graph) {
        showToast('Routing graph still loading — try again in a moment', 'error');
        return;
      }

      // Snap start and end to graph nodes
      // Pick entrance closest to user
      let destLat = destination.lat, destLng = destination.lng;
      if (destination.entrances?.length) {
        let best = null, bestDist = Infinity;
        for (const e of destination.entrances) {
          const d = Math.hypot(e.lat - fromLat, e.lng - fromLng);
          if (d < bestDist) { bestDist = d; best = e; }
        }
        if (best) { destLat = best.lat; destLng = best.lng; }
      }

      const startNodeId = findNearestNode(graph.nodes, fromLat, fromLng, 500, graph.index);
      const endNodeId   = findNearestNode(graph.nodes, destLat, destLng, 500, graph.index);

      if (!startNodeId) { showToast('Your location is too far from campus', 'error'); return; }
      if (!endNodeId)   { showToast('Destination not in routing graph', 'error');     return; }

      // Run A*
      const result = runAStar(graph.nodes, graph.edges, startNodeId, endNodeId);
      if (!result) { showToast('No route found between these points', 'error'); return; }

      const { coords, pathNodeIds, totalDistM } = result;

      // Count traversed shortcut edges
      const usedIds = new Set();
      for (let i = 0; i < pathNodeIds.length - 1; i++) {
        const fid1 = graph.syntheticToFeatureId?.get(pathNodeIds[i]);
        const fid2 = graph.syntheticToFeatureId?.get(pathNodeIds[i + 1]);
        if (fid1 && fid1 === fid2) usedIds.add(fid1);
      }
      setUsedShortcutIds(usedIds);

      // Render route on map
      map.current.getSource('route-source').setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }],
      });

      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibreRef.current.LngLatBounds(coords[0], coords[0])
      );
      map.current.fitBounds(bounds, { padding: 80, duration: 1000 });

      // Update route info panel
      const walkSpeedMs = 1.4; // average walking pace m/s
      setRouteInfo({
        distance: (totalDistM * 0.000621371).toFixed(2),
        duration: Math.ceil(totalDistM / walkSpeedMs / 60),
        shortcutUsed: usedIds.size > 0,
      });

    } catch (err) {
      if (err.code === 1)                      showToast('Location access denied — check browser permissions', 'error');
      else if (err.message === 'location-timeout') showToast('Could not get your location — pick a start building instead', 'error');
      else { console.error('Routing error:', err); showToast('Could not get directions', 'error'); }
    } finally {
      setIsRouting(false);
    }
  };

  const deleteSelectedPath = async () => {
    if (!selectedPathId || !db) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shortcuts', selectedPathId));
      setSelectedPathId(null);
      showToast('Path deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Delete failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    clearDestination();
  };

  const startDrawingMode = () => {
    if (!draw.current) return;
    setSelectedPathId(null);
    draw.current.changeMode('draw_line_string');
    setIsDrawing(true);
  };

  selectBuildingRef.current = handleSelectResult;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden relative">

      <Toast toast={toast} />

      <SearchHeader
        searchQuery={searchQuery}
        searchResults={searchResults}
        onSearchInput={handleSearchInput}
        onSelectResult={handleSelectResult}
        isAdmin={isAdmin}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 w-full h-full relative z-10">
        <div
          ref={mapContainer}
          role="application"
          aria-label="Campus map"
          className="absolute inset-0 w-full h-full bg-slate-100"
          style={{ cursor: isDrawing ? 'crosshair' : 'grab' }}
        />

        {destination && (
          <DirectionsPanel
            destination={destination}
            onClear={clearDestination}
            startQuery={startQuery}
            onStartInput={handleStartInput}
            startLocation={startLocation}
            onClearStart={clearStart}
            startResults={startResults}
            onSelectStart={handleSelectStart}
            routeInfo={routeInfo}
            isRouting={isRouting}
            onGetDirections={getDirections}
          />
        )}

        {isAdmin && (
          <AdminPanel
            isDrawing={isDrawing}
            selectedPathId={selectedPathId}
            isDeleting={isDeleting}
            showOsmPaths={showOsmPaths}
            onDelete={deleteSelectedPath}
            onCancelSelect={() => setSelectedPathId(null)}
            onToggleOsmPaths={() => setShowOsmPaths(v => !v)}
            onStartDrawing={startDrawingMode}
          />
        )}
      </main>

      {authStage === 'login' && <LoginScreen />}
      {authStage === 'loading' && <LoadingScreen />}
    </div>
  );
}
