export interface Entrance {
  lat: number;
  lng: number;
}

export interface Building {
  name: string;
  category: string;
  lat: number;
  lng: number;
  entrances?: Entrance[];
}

export interface RouteDestination {
  lat: number;
  lng: number;
  entrances?: Entrance[];
}

export interface ShortcutGeometry {
  type: string;
  coordinates: [number, number][];
}

export interface ShortcutFeature {
  type: "Feature";
  id: string;
  geometry?: ShortcutGeometry;
  properties?: Record<string, unknown>;
}

export interface ShortcutCollection {
  type: "FeatureCollection";
  features: ShortcutFeature[];
}

export type RoutePlan =
  | { error: "start-too-far" | "dest-not-found" | "no-route" }
  | {
      error?: undefined;
      coords: [number, number][];
      usedShortcutIds: Set<string>;
      totalDistM: number;
      distanceMiles: string;
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
