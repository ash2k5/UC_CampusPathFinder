"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Map as MapIcon, ShieldCheck, Loader2, MousePointer2, Plus, Users, Navigation, X, Clock, Footprints, Trash2, CheckCircle } from 'lucide-react';
import { searchBuildings, CATEGORY_COLORS, UC_BUILDINGS } from './buildings';
import { buildBaseGraph, buildRoutingGraph, findNearestNode, runDijkstra } from './graph';

// Firebase Imports
import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app, auth, db;
const APP_ID = "campus-nav-v1";

if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  if (firebaseConfig.measurementId) getAnalytics(app);
}

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const CAMPUS_CENTER = [-84.5150, 39.1310];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

export default function Page() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const markerRef = useRef(null);
  const userMarkerRef = useRef(null);

  // Refs to avoid stale closures inside map event listeners
  const userRef = useRef(null);
  const isAdminRef = useRef(false);
  const shortcutsRef = useRef(EMPTY_GEOJSON);

  // Routing graph refs
  const osmGraphRef = useRef(null);      // base OSM graph (built once on load)
  const routingGraphRef = useRef(null);  // OSM + custom shortcuts (rebuilt when shortcuts change)
  const osmGeoJsonRef = useRef(null);    // raw GeoJSON of OSM walkable ways (for overlay)
  const pathClickConsumedRef = useRef(false);
  const selectedPathIdRef = useRef(null);
  const selectBuildingRef = useRef(null);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [shortcuts, setShortcuts] = useState(EMPTY_GEOJSON);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [graphStatus, setGraphStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  const [destination, setDestination] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null); // { distance, duration, usedShortcutIds }
  const [usedShortcutIds, setUsedShortcutIds] = useState(new Set());

  const [startQuery, setStartQuery] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [startLocation, setStartLocation] = useState(null); // null = use GPS

  const [showOsmPaths, setShowOsmPaths] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type: 'success' | 'error' }

  const [authStage, setAuthStage] = useState('loading'); // 'loading' | 'login' | 'app'
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  // Auth
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAdmin(!currentUser.isAnonymous && ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase()));
        setAuthStage('app');
      } else {
        setAuthStage('login');
      }
    });
    return () => unsub();
  }, []);

  // Load shortcuts from Firestore
  useEffect(() => {
    if (!db || !user) return;
    const ref = collection(db, 'artifacts', APP_ID, 'public', 'data', 'shortcuts');
    const unsub = onSnapshot(ref, (snapshot) => {
      const features = snapshot.docs.map(d => ({
        type: 'Feature',
        id: d.id,
        geometry: JSON.parse(d.data().geometry),
        properties: { ...d.data().properties, _id: d.id }
      }));
      setShortcuts({ type: 'FeatureCollection', features });
    }, (error) => console.error("Firestore error:", error));
    return () => unsub();
  }, [user]);

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

    const loadDependencies = async () => {
      const styles = [
        'https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css',
        'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css'
      ];
      styles.forEach(href => {
        if (!document.querySelector(`link[href="${href}"]`)) {
          const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
          document.head.appendChild(link);
        }
      });

      const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script'); s.src = src; s.async = true;
        s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
      });

      try {
        await loadScript('https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js');
        await loadScript('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js');
        initMap();
      } catch (err) { console.error(err); }
    };

    const initMap = () => {
      if (!window.maplibregl || !window.MapboxDraw || map.current) return;

      map.current = new window.maplibregl.Map({
        container: mapContainer.current, style: MAP_STYLE, center: CAMPUS_CENTER, zoom: 15,
      });
      map.current.addControl(new window.maplibregl.NavigationControl(), 'top-right');

      draw.current = new window.MapboxDraw({
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

        // Selected path highlight (red — admin delete mode)
        map.current.addSource('selected-source', { type: 'geojson', data: EMPTY_GEOJSON });
        map.current.addLayer({
          id: 'selected-layer', type: 'line', source: 'selected-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ef4444', 'line-width': 8, 'line-opacity': 0.9 }
        });

        // Active shortcut highlight (amber — currently used for routing)
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
          pathClickConsumedRef.current = true;
          const id = e.features[0]?.properties?._id;
          if (!id) return;
          setSelectedPathId(prev => prev === id ? null : id);
        });

        // Cursor: pointer over paths in admin mode
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

    loadDependencies();
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

  // Sync active shortcut highlight to map (all shortcuts actually traversed by Dijkstra)
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

  // Admin draw controls — deselect when leaving admin mode
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
      markerRef.current = new window.maplibregl.Marker({ color: '#2563eb' })
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
      // ── 1. Resolve start position ─────────────────────────────────────────
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

      // ── 2. Place start marker ─────────────────────────────────────────────
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = new window.maplibregl.Marker({ color: '#16a34a' })
        .setLngLat([fromLng, fromLat])
        .addTo(map.current);

      // ── 3. Ensure graph is ready ──────────────────────────────────────────
      const graph = routingGraphRef.current;
      if (!graph) {
        showToast('Routing graph still loading — try again in a moment', 'error');
        return;
      }

      // ── 4. Snap start and end to nearest graph nodes ──────────────────────
      // If destination has multiple entrances, pick the one closest to the user
      let destLat = destination.lat, destLng = destination.lng;
      if (destination.entrances?.length) {
        let best = null, bestDist = Infinity;
        for (const e of destination.entrances) {
          const d = Math.hypot(e.lat - fromLat, e.lng - fromLng);
          if (d < bestDist) { bestDist = d; best = e; }
        }
        if (best) { destLat = best.lat; destLng = best.lng; }
      }

      const startNodeId = findNearestNode(graph.nodes, fromLat, fromLng, 500);
      const endNodeId   = findNearestNode(graph.nodes, destLat, destLng, 500);

      if (!startNodeId) { showToast('Your location is too far from campus', 'error'); return; }
      if (!endNodeId)   { showToast('Destination not in routing graph', 'error');     return; }

      // ── 5. Run Dijkstra on combined OSM + shortcut graph ──────────────────
      const result = runDijkstra(graph.nodes, graph.edges, startNodeId, endNodeId);
      if (!result) { showToast('No route found between these points', 'error'); return; }

      const { coords, pathNodeIds, totalDistM } = result;

      // ── 6. Detect which custom shortcuts were actually traversed ──────────
      // Only count a shortcut if two consecutive path nodes are both from it,
      // meaning an actual drawn edge was used (not just an endpoint relay node).
      const usedIds = new Set();
      for (let i = 0; i < pathNodeIds.length - 1; i++) {
        const fid1 = graph.syntheticToFeatureId?.get(pathNodeIds[i]);
        const fid2 = graph.syntheticToFeatureId?.get(pathNodeIds[i + 1]);
        if (fid1 && fid1 === fid2) usedIds.add(fid1);
      }
      setUsedShortcutIds(usedIds);

      // ── 7. Render route on map ────────────────────────────────────────────
      map.current.getSource('route-source').setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }],
      });

      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new window.maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.current.fitBounds(bounds, { padding: 80, duration: 1000 });

      // ── 8. Update route info panel ────────────────────────────────────────
      const walkSpeedMs = 1.4; // m/s average walking pace
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

  const AUTH_ERRORS = {
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts — try again later.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err) {
      setLoginError(AUTH_ERRORS[err.code] || 'Login failed. Check your credentials.');
      setIsLoggingIn(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err) {
      setLoginError(AUTH_ERRORS[err.code] || `Sign up failed: ${err.code}`);
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setIsAdmin(false);
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

      {/* Toast */}
      {toast && (
        <div className={`absolute top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold transition-all ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}`}>
          {toast.type !== 'error' && <CheckCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Search Header */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 p-2 flex items-center gap-2 pointer-events-auto">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><MapIcon size={20} /></div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder="Search campus buildings..."
              className="w-full bg-transparent outline-none px-2 font-medium text-slate-700"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                {searchResults.map((r) => (
                  <button
                    key={r.name}
                    onClick={() => handleSelectResult(r)}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center gap-2"
                  >
                    <span>{CATEGORY_COLORS[r.category] || '📍'}</span>
                    <span>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold">
              <ShieldCheck size={14} /> Admin
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 w-full h-full relative z-10">
        <div
          ref={mapContainer}
          className="absolute inset-0 w-full h-full bg-slate-100"
          style={{ cursor: isDrawing ? 'crosshair' : 'grab' }}
        />

        {/* Directions Panel */}
        {destination && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 bg-white rounded-3xl shadow-2xl border border-slate-100 w-80 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-0.5">
                  {CATEGORY_COLORS[destination.category]} {destination.category}
                </p>
                <h3 className="font-bold text-slate-800 text-sm leading-tight">{destination.name}</h3>
              </div>
              <button onClick={clearDestination} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Optional start location */}
            <div className="mb-3 relative">
              <p className="text-xs text-slate-400 font-semibold mb-1">From</p>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <Navigation size={13} className="text-green-500 shrink-0" />
                <input
                  type="text"
                  value={startQuery}
                  onChange={handleStartInput}
                  placeholder="Your location (GPS)"
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700 font-medium"
                />
                {startLocation && (
                  <button onClick={clearStart} className="text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              {startResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  {startResults.map((r) => (
                    <button
                      key={r.name}
                      onClick={() => handleSelectStart(r)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center gap-2"
                    >
                      <span>{CATEGORY_COLORS[r.category] || '📍'}</span>
                      <span>{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {routeInfo && (
              <>
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                    <Footprints size={14} className="text-blue-500 mx-auto mb-1" />
                    <p className="font-bold text-slate-800 text-sm">{routeInfo.distance} mi</p>
                    <p className="text-xs text-slate-400">distance</p>
                  </div>
                  <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                    <Clock size={14} className="text-blue-500 mx-auto mb-1" />
                    <p className="font-bold text-slate-800 text-sm">{routeInfo.duration} min</p>
                    <p className="text-xs text-slate-400">walk</p>
                  </div>
                </div>
                {routeInfo.shortcutUsed && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                    <span className="text-amber-500 text-base">⚡</span>
                    <div>
                      <p className="text-xs font-bold text-amber-700">Campus shortcut used</p>
                      <p className="text-xs text-amber-600">Optimal route — follow the yellow path</p>
                    </div>
                  </div>
                )}
              </>
            )}
            <button
              onClick={getDirections}
              disabled={isRouting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
            >
              {isRouting
                ? <><Loader2 size={16} className="animate-spin" /> {startLocation ? 'Getting route...' : 'Getting location...'}</>
                : <><Navigation size={16} /> {routeInfo ? 'Reroute' : 'Get Walking Directions'}</>
              }
            </button>
          </div>
        )}

        {/* Admin Panel */}
        {isAdmin && (
          <div className="absolute bottom-10 left-6 z-30 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 w-80 space-y-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-blue-500" /> Collaborative Editor
            </h3>

            {selectedPathId ? (
              <>
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-[11px] text-red-700 font-bold">
                  Path selected — highlighted in red on the map
                </div>
                <button
                  onClick={deleteSelectedPath}
                  disabled={isDeleting}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  {isDeleting
                    ? <><Loader2 size={16} className="animate-spin" /> Deleting...</>
                    : <><Trash2 size={16} /> Delete This Path</>
                  }
                </button>
                <button
                  onClick={() => setSelectedPathId(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-2xl text-sm transition-all"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {isDrawing ? (
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-[11px] text-blue-700 font-bold flex gap-2">
                    <MousePointer2 size={14} className="shrink-0 mt-0.5" />
                    Click to place points. Double-click to finish — path saves automatically.
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-400">
                      Draw new paths, or click an existing green path to select and delete it.
                    </p>
                    <button
                      onClick={() => setShowOsmPaths(v => !v)}
                      className={`w-full py-2 rounded-2xl text-xs font-bold transition-all ${showOsmPaths ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {showOsmPaths ? 'Hide OSM Paths' : 'Show OSM Paths'}
                    </button>
                  </>
                )}
                <button
                  onClick={startDrawingMode}
                  disabled={isDrawing}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Plus size={18} /> {isDrawing ? 'Drawing...' : 'Start New Path'}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Login screen */}
      {authStage === 'login' && (
        <div className="absolute inset-0 z-50 bg-linear-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow"><MapIcon size={22} /></div>
              <div>
                <h1 className="font-bold text-slate-800 text-lg leading-tight">UC CampusPathFinder</h1>
                <p className="text-xs text-slate-400">Sign in to continue</p>
              </div>
            </div>

            {/* Toggle */}
            <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
              <button
                onClick={() => { setAuthMode('login'); setLoginError(''); }}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
              >Sign In</button>
              <button
                onClick={() => { setAuthMode('signup'); setLoginError(''); }}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMode === 'signup' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
              >Create Account</button>
            </div>

            <form onSubmit={authMode === 'login' ? handleLogin : handleSignUp} className="space-y-3 mb-4">
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-200 text-sm"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder={authMode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-200 text-sm"
              />
              {loginError && <p className="text-xs text-red-500 font-semibold px-1">{loginError}</p>}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all"
              >
                {isLoggingIn && <Loader2 size={16} className="animate-spin" />}
                {isLoggingIn ? (authMode === 'login' ? 'Signing in...' : 'Creating account...') : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* Loading screen (after login, while map/auth initializes) */}
      {authStage === 'loading' && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Connecting...</p>
        </div>
      )}
    </div>
  );
}
