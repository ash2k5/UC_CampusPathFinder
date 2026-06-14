"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
} from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { db, APP_ID } from "./lib/firebase";
import { EMPTY_GEOJSON } from "./lib/constants";
import { searchBuildings } from "./buildings";
import { planRoute } from "./graph";
import { useAuth } from "./hooks/useAuth";
import { useShortcuts } from "./hooks/useShortcuts";
import { useRouting } from "./hooks/useRouting";
import { useCampusMap } from "./hooks/useCampusMap";
import Toast from "./components/Toast";
import SearchHeader from "./components/SearchHeader";
import DirectionsPanel from "./components/DirectionsPanel";
import AdminPanel from "./components/AdminPanel";
import LoginScreen from "./components/LoginScreen";
import LoadingScreen from "./components/LoadingScreen";
import type {
  Building,
  RouteInfo,
  ToastMessage,
  CampusMap,
  RoutePlan,
} from "./types";

import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const tokenColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  "#000000";

export default function Page() {
  const { user, isAdmin, authStage, logout } = useAuth();
  const shortcuts = useShortcuts(user);
  const { graphStatus, routingGraphRef, osmGeoJsonRef } = useRouting(shortcuts);

  const markerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  // Refs avoid stale closures
  const userRef = useRef<any>(null);
  const isAdminRef = useRef(false);
  const selectedPathIdRef = useRef<string | null>(null);
  const selectBuildingRef = useRef<((r: Building) => void) | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Building[]>([]);

  const [destination, setDestination] = useState<Building | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [usedShortcutIds, setUsedShortcutIds] = useState<Set<string>>(new Set());

  const [startQuery, setStartQuery] = useState("");
  const [startResults, setStartResults] = useState<Building[]>([]);
  const [startLocation, setStartLocation] = useState<Building | null>(null);

  const [showOsmPaths, setShowOsmPaths] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (msg: string, type: ToastMessage["type"] = "success") =>
      setToast({ msg, type }),
    []
  );

  const { mapContainer, map, draw, maplibreRef, isDrawing, setIsDrawing } =
    useCampusMap({
      isAdmin,
      shortcuts,
      selectedPathId,
      showOsmPaths,
      usedShortcutIds,
      graphStatus,
      osmGeoJsonRef,
      isAdminRef,
      userRef,
      selectBuildingRef,
      setSelectedPathId,
      showToast,
    }) as unknown as CampusMap;

  // Keep refs in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);
  useEffect(() => {
    selectedPathIdRef.current = selectedPathId;
  }, [selectedPathId]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Backspace / Delete key to remove selected path
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const pathId = selectedPathIdRef.current;
      if (!pathId || !isAdminRef.current || !db) return;
      setIsDeleting(true);
      deleteDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "shortcuts", pathId)
      )
        .then(() => {
          setSelectedPathId(null);
          setToast({ msg: "Path deleted", type: "success" });
        })
        .catch(() =>
          setToast({ msg: "Delete failed — check Firestore rules", type: "error" })
        )
        .finally(() => setIsDeleting(false));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Search
  const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchResults(searchBuildings(q));
  };

  const handleSelectResult = (result: Building) => {
    setSearchQuery(result.name);
    setSearchResults([]);
    setDestination(result);
    setRouteInfo(null);
    if (map.current?.getSource("route-source")) {
      map.current.getSource("route-source").setData(EMPTY_GEOJSON);
    }
    if (markerRef.current) markerRef.current.remove();
    if (map.current) {
      markerRef.current = new maplibreRef.current.Marker({
        color: tokenColor("--primary"),
      })
        .setLngLat([result.lng, result.lat])
        .addTo(map.current);
      map.current.flyTo({
        center: [result.lng, result.lat],
        zoom: 17,
        duration: 1000,
      });
    }
  };

  const clearDestination = () => {
    setDestination(null);
    setRouteInfo(null);
    setUsedShortcutIds(new Set());
    setSearchQuery("");
    setStartQuery("");
    setStartResults([]);
    setStartLocation(null);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (map.current?.getSource("route-source")) {
      map.current.getSource("route-source").setData(EMPTY_GEOJSON);
    }
  };

  const handleStartInput = (e: ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setStartQuery(q);
    setStartLocation(null);
    setStartResults(q.trim().length >= 2 ? searchBuildings(q) : []);
  };

  const handleSelectStart = (building: Building) => {
    setStartLocation(building);
    setStartQuery(building.name);
    setStartResults([]);
  };

  const clearStart = () => {
    setStartLocation(null);
    setStartQuery("");
    setStartResults([]);
  };

  const getDirections = async () => {
    if (!destination || !map.current) return;
    setIsRouting(true);
    setUsedShortcutIds(new Set());

    try {
      // Resolve start position
      let fromLng: number, fromLat: number;

      if (startLocation) {
        fromLng = startLocation.lng;
        fromLat = startLocation.lat;
      } else {
        if (!navigator.geolocation) {
          showToast("Enable location or choose a start building", "error");
          return;
        }
        const position: any = await Promise.race([
          new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 8000,
              maximumAge: 60000,
              enableHighAccuracy: false,
            })
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("location-timeout")), 10000)
          ),
        ]);
        fromLng = position.coords.longitude;
        fromLat = position.coords.latitude;
      }

      // Place start marker
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = new maplibreRef.current.Marker({
        color: tokenColor("--success"),
      })
        .setLngLat([fromLng, fromLat])
        .addTo(map.current);

      // Ensure graph is ready
      const graph = routingGraphRef.current;
      if (!graph) {
        showToast("Routing graph still loading — try again in a moment", "error");
        return;
      }

      const plan = planRoute(graph, fromLat, fromLng, destination) as RoutePlan;
      if (plan.error) {
        const message =
          plan.error === "start-too-far"
            ? "Your location is too far from campus"
            : plan.error === "dest-not-found"
              ? "Destination not in routing graph"
              : "No route found between these points";
        showToast(message, "error");
        return;
      }

      const { coords, usedShortcutIds: usedIds } = plan;
      setUsedShortcutIds(usedIds);

      // Render route on map
      map.current.getSource("route-source").setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
          },
        ],
      });

      const bounds = coords.reduce(
        (b: any, c: [number, number]) => b.extend(c),
        new maplibreRef.current.LngLatBounds(coords[0], coords[0])
      );
      map.current.fitBounds(bounds, { padding: 80, duration: 1000 });

      // Update route info panel
      setRouteInfo({
        distance: plan.distanceMiles,
        duration: plan.durationMin,
        shortcutUsed: usedIds.size > 0,
      });
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 1)
        showToast("Location access denied — check browser permissions", "error");
      else if (e.message === "location-timeout")
        showToast(
          "Could not get your location — pick a start building instead",
          "error"
        );
      else {
        console.error("Routing error:", err);
        showToast("Could not get directions", "error");
      }
    } finally {
      setIsRouting(false);
    }
  };

  const deleteSelectedPath = async () => {
    if (!selectedPathId || !db) return;
    setIsDeleting(true);
    try {
      await deleteDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "shortcuts", selectedPathId)
      );
      setSelectedPathId(null);
      showToast("Path deleted");
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Delete failed", "error");
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
    draw.current.changeMode("draw_line_string");
    setIsDrawing(true);
  };

  selectBuildingRef.current = handleSelectResult;

  return (
    <div className="flex flex-col h-screen w-screen bg-surface overflow-hidden relative">
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
          className="absolute inset-0 w-full h-full bg-surface-container"
          style={{ cursor: isDrawing ? "crosshair" : "grab" }}
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
            onToggleOsmPaths={() => setShowOsmPaths((v) => !v)}
            onStartDrawing={startDrawingMode}
          />
        )}
      </main>

      {authStage === "login" && <LoginScreen />}
      {authStage === "loading" && <LoadingScreen />}
    </div>
  );
}
