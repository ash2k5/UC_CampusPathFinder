import type { ChangeEvent } from "react";
import { Navigation, X, Footprints, Clock, Zap } from "lucide-react";
import { Button } from "@ash2k5/cinematic-ds";
import CategoryIcon from "./CategoryIcon";
import type { Building, RouteInfo } from "../types";

interface DirectionsPanelProps {
  destination: Building;
  onClear: () => void;
  startQuery: string;
  onStartInput: (e: ChangeEvent<HTMLInputElement>) => void;
  startLocation: Building | null;
  onClearStart: () => void;
  startResults: Building[];
  onSelectStart: (b: Building) => void;
  routeInfo: RouteInfo | null;
  isRouting: boolean;
  onGetDirections: () => void;
}

export default function DirectionsPanel({
  destination,
  onClear,
  startQuery,
  onStartInput,
  startLocation,
  onClearStart,
  startResults,
  onSelectStart,
  routeInfo,
  isRouting,
  onGetDirections,
}: DirectionsPanelProps) {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 ds-glass ds-glass--floating w-80 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="ds-label-sm text-primary mb-0.5 flex items-center gap-1">
            <CategoryIcon category={destination.category} /> {destination.category}
          </p>
          <h3 className="font-display text-lg font-semibold leading-tight text-on-surface">
            {destination.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Close directions"
          className="text-on-surface-variant hover:text-on-surface p-1"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="mb-3 relative">
        <p className="ds-label-sm text-on-surface-variant mb-1">From</p>
        <div className="flex items-center gap-2 bg-surface-container px-3 py-2 border border-outline-variant">
          <Navigation size={13} className="text-success shrink-0" aria-hidden />
          <input
            type="text"
            value={startQuery}
            onChange={onStartInput}
            placeholder="Your location (GPS)"
            aria-label="Starting point"
            className="flex-1 bg-transparent outline-none ds-body-sm text-on-surface"
          />
          {startLocation && (
            <button
              type="button"
              onClick={onClearStart}
              aria-label="Clear starting point"
              className="text-on-surface-variant hover:text-on-surface"
            >
              <X size={13} aria-hidden />
            </button>
          )}
        </div>
        {startResults.length > 0 && (
          <ul className="absolute top-full left-0 right-0 mt-1 ds-glass ds-glass--floating max-h-60 overflow-y-auto list-none m-0 p-0 z-50">
            {startResults.map((r) => (
              <li key={r.name}>
                <button
                  type="button"
                  onClick={() => onSelectStart(r)}
                  className="w-full text-left px-4 py-2.5 ds-body-sm text-on-surface hover:bg-surface-container-high border-b border-outline-variant last:border-0 flex items-center gap-2"
                >
                  <CategoryIcon
                    category={r.category}
                    className="text-on-surface-variant shrink-0"
                  />
                  <span>{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {routeInfo && (
        <>
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-surface-container p-3 text-center border border-outline-variant">
              <Footprints
                size={14}
                className="text-on-surface-variant mx-auto mb-1"
                aria-hidden
              />
              <p className="text-base font-semibold text-on-surface ds-tabular">
                {routeInfo.distance} mi
              </p>
              <p className="ds-label-sm text-on-surface-variant">distance</p>
            </div>
            <div className="flex-1 bg-surface-container p-3 text-center border border-outline-variant">
              <Clock
                size={14}
                className="text-on-surface-variant mx-auto mb-1"
                aria-hidden
              />
              <p className="text-base font-semibold text-on-surface ds-tabular">
                {routeInfo.duration} min
              </p>
              <p className="ds-label-sm text-on-surface-variant">walk</p>
            </div>
          </div>
          {routeInfo.shortcutUsed && (
            <div className="flex items-center gap-2 bg-warning-container px-3 py-2 mb-3 border border-outline-variant">
              <Zap size={16} className="text-warning shrink-0" aria-hidden />
              <div>
                <p className="ds-label-sm text-on-surface">Campus shortcut used</p>
                <p className="ds-body-sm text-on-surface-variant">
                  Optimal route — follow the highlighted path
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <Button
        variant="primary"
        onClick={onGetDirections}
        loading={isRouting}
        className="w-full"
      >
        {isRouting ? (
          startLocation ? (
            "Getting route..."
          ) : (
            "Getting location..."
          )
        ) : (
          <>
            <Navigation size={16} aria-hidden />{" "}
            {routeInfo ? "Reroute" : "Get Walking Directions"}
          </>
        )}
      </Button>
    </div>
  );
}
