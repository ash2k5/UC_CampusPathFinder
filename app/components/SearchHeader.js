import { Map as MapIcon, ShieldCheck } from 'lucide-react';
import CategoryIcon from './CategoryIcon';

export default function SearchHeader({ searchQuery, searchResults, onSearchInput, onSelectResult, isAdmin, onSignOut }) {
  return (
    <header className="absolute top-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4 pointer-events-none">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 p-2 flex items-center gap-2 pointer-events-auto">
        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><MapIcon size={20} /></div>
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={onSearchInput}
            placeholder="Search campus buildings..."
            aria-label="Search campus buildings"
            className="w-full bg-transparent outline-none px-2 font-medium text-slate-700"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
              {searchResults.map((r) => (
                <button
                  key={r.name}
                  onClick={() => onSelectResult(r)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center gap-2"
                >
                  <CategoryIcon category={r.category} className="text-slate-400 shrink-0" />
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
          onClick={onSignOut}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
