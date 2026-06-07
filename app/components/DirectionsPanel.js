import { Navigation, X, Footprints, Clock, Zap, Loader2 } from 'lucide-react';
import CategoryIcon from './CategoryIcon';

export default function DirectionsPanel({
  destination, onClear,
  startQuery, onStartInput, startLocation, onClearStart, startResults, onSelectStart,
  routeInfo, isRouting, onGetDirections,
}) {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 bg-white rounded-3xl shadow-2xl border border-slate-100 w-80 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-0.5 flex items-center gap-1">
            <CategoryIcon category={destination.category} /> {destination.category}
          </p>
          <h3 className="font-bold text-slate-800 text-sm leading-tight">{destination.name}</h3>
        </div>
        <button onClick={onClear} aria-label="Close directions" className="text-slate-400 hover:text-slate-600 p-1">
          <X size={16} />
        </button>
      </div>

      <div className="mb-3 relative">
        <p className="text-xs text-slate-400 font-semibold mb-1">From</p>
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
          <Navigation size={13} className="text-green-500 shrink-0" />
          <input
            type="text"
            value={startQuery}
            onChange={onStartInput}
            placeholder="Your location (GPS)"
            aria-label="Starting point"
            className="flex-1 bg-transparent outline-none text-sm text-slate-700 font-medium"
          />
          {startLocation && (
            <button onClick={onClearStart} aria-label="Clear starting point" className="text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
        {startResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
            {startResults.map((r) => (
              <button
                key={r.name}
                onClick={() => onSelectStart(r)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center gap-2"
              >
                <CategoryIcon category={r.category} className="text-slate-400 shrink-0" />
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
              <Zap size={16} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700">Campus shortcut used</p>
                <p className="text-xs text-amber-600">Optimal route — follow the yellow path</p>
              </div>
            </div>
          )}
        </>
      )}
      <button
        onClick={onGetDirections}
        disabled={isRouting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
      >
        {isRouting
          ? <><Loader2 size={16} className="animate-spin" /> {startLocation ? 'Getting route...' : 'Getting location...'}</>
          : <><Navigation size={16} /> {routeInfo ? 'Reroute' : 'Get Walking Directions'}</>
        }
      </button>
    </div>
  );
}
