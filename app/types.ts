import type { RefObject } from "react";

export interface Building {
  name: string;
  category: string;
  lat: number;
  lng: number;
}

// Boundary types for the still-JS map hook and routing core (migrated later).
export interface CampusMap {
  mapContainer: RefObject<HTMLDivElement | null>;
  map: RefObject<any>;
  draw: RefObject<any>;
  maplibreRef: RefObject<any>;
  isDrawing: boolean;
  setIsDrawing: (value: boolean) => void;
}

export type RoutePlan =
  | { error: "start-too-far" | "dest-not-found" | "no-route" }
  | {
      error?: undefined;
      coords: [number, number][];
      usedShortcutIds: Set<string>;
      distanceMiles: number;
      durationMin: number;
    };

export interface RouteInfo {
  distance: number | string;
  duration: number | string;
  shortcutUsed: boolean;
}

export interface ToastMessage {
  msg: string;
  type: "success" | "error";
}
