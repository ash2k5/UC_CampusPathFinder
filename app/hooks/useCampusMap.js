'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import { CAMPUS_CENTER, MAP_STYLE, EMPTY_GEOJSON } from '../lib/constants';
import { UC_BUILDINGS } from '../buildings';

// Owns the MapLibre map lifecycle: initialization, layer/source setup, the
// admin draw control, and every source/visibility sync effect. Leaves page.js
// to wire state and user actions. Returns the refs page.js needs to place
// markers, fit bounds, and drive drawing.
export function useCampusMap({
  isAdmin, shortcuts, selectedPathId, showOsmPaths, usedShortcutIds, graphStatus,
  osmGeoJsonRef, isAdminRef, userRef, selectBuildingRef,
  setSelectedPathId, showToast,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const maplibreRef = useRef(null);

  const pathClickConsumedRef = useRef(false);
  const lastDrawCreateRef = useRef(0);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Push the OSM overlay onto the map once both the graph and map are ready
  useEffect(() => {
    if (graphStatus !== 'ready' || !isMapLoaded) return;
    if (map.current?.getSource('osm-paths-source')) {
      map.current.getSource('osm-paths-source').setData(osmGeoJsonRef.current);
    }
  }, [graphStatus, isMapLoaded, osmGeoJsonRef]);

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

        // OSM walkable paths overlay (admin reference layer), populated by the overlay-sync effect
        map.current.addSource('osm-paths-source', { type: 'geojson', data: EMPTY_GEOJSON });
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
  }, [isAdminRef, userRef, selectBuildingRef, setSelectedPathId, showToast]);

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
  }, [isAdmin, isMapLoaded, setSelectedPathId]);

  return { mapContainer, map, draw, maplibreRef, isMapLoaded, isDrawing, setIsDrawing };
}
