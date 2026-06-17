import type { ChangeEvent } from "react";
import { Map as MapIcon, ShieldCheck } from "lucide-react";
import { Badge, Button, ThemeToggle } from "@ash2k5/ui";
import CategoryIcon from "./CategoryIcon";
import type { Building } from "../types";

interface SearchHeaderProps {
  searchQuery: string;
  searchResults: Building[];
  onSearchInput: (e: ChangeEvent<HTMLInputElement>) => void;
  onSelectResult: (result: Building) => void;
  isAdmin: boolean;
  onSignOut: () => void;
}

export default function SearchHeader({
  searchQuery,
  searchResults,
  onSearchInput,
  onSelectResult,
  isAdmin,
  onSignOut,
}: SearchHeaderProps) {
  return (
    <header className="absolute top-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-none">
      <div className="ds-glass ds-glass--floating pointer-events-auto flex items-center gap-2 p-2">
        <div className="grid size-10 place-items-center bg-primary text-on-primary shrink-0">
          <MapIcon size={20} aria-hidden />
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={onSearchInput}
            placeholder="Search campus buildings..."
            aria-label="Search campus buildings"
            className="w-full bg-transparent outline-none px-2 font-body text-on-surface placeholder:text-outline"
          />
          {searchResults.length > 0 && (
            <ul className="absolute top-full left-0 right-0 mt-2 ds-glass ds-glass--floating max-h-72 overflow-y-auto list-none m-0 p-0 z-50">
              {searchResults.map((r) => (
                <li key={r.name}>
                  <button
                    type="button"
                    onClick={() => onSelectResult(r)}
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
        {isAdmin && (
          <Badge variant="warning" className="shrink-0">
            <ShieldCheck size={14} aria-hidden /> Admin
          </Badge>
        )}
        <ThemeToggle className="size-9 shrink-0" />
        <Button
          variant="text"
          onClick={onSignOut}
          className="shrink-0 px-2 py-1 text-[length:var(--text-label-sm-size)]"
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
}
