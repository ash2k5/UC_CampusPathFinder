import { Users, MousePointer2, Plus, Trash2 } from "lucide-react";
import { Button } from "@ash2k5/cinematic-ds";

interface AdminPanelProps {
  isDrawing: boolean;
  selectedPathId: string | null;
  isDeleting: boolean;
  showOsmPaths: boolean;
  onDelete: () => void;
  onCancelSelect: () => void;
  onToggleOsmPaths: () => void;
  onStartDrawing: () => void;
}

export default function AdminPanel({
  isDrawing,
  selectedPathId,
  isDeleting,
  showOsmPaths,
  onDelete,
  onCancelSelect,
  onToggleOsmPaths,
  onStartDrawing,
}: AdminPanelProps) {
  return (
    <div className="absolute bottom-10 left-6 z-30 ds-glass ds-glass--floating w-80 p-6 space-y-3">
      <h3 className="font-display text-lg font-semibold flex items-center gap-2 text-on-surface">
        <Users size={18} className="text-primary" aria-hidden /> Collaborative Editor
      </h3>

      {selectedPathId ? (
        <>
          <div className="bg-error-container px-3 py-3 ds-body-sm font-semibold text-on-error-container border border-outline-variant">
            Path selected — highlighted in red on the map
          </div>
          <Button
            variant="primary"
            onClick={onDelete}
            loading={isDeleting}
            className="w-full bg-error text-on-error"
          >
            <Trash2 size={16} aria-hidden /> {isDeleting ? "Deleting..." : "Delete This Path"}
          </Button>
          <Button variant="ghost" onClick={onCancelSelect} className="w-full">
            Cancel
          </Button>
        </>
      ) : (
        <>
          {isDrawing ? (
            <div className="bg-info-container px-3 py-3 ds-body-sm text-on-surface flex gap-2 border border-outline-variant">
              <MousePointer2 size={14} className="shrink-0 mt-0.5" aria-hidden />
              Click to place points. Double-click to finish — path saves automatically.
            </div>
          ) : (
            <>
              <p className="ds-body-sm text-on-surface-variant">
                Draw new paths, or click an existing path to select and delete it.
              </p>
              <Button
                variant={showOsmPaths ? "primary" : "ghost"}
                onClick={onToggleOsmPaths}
                className="w-full"
              >
                {showOsmPaths ? "Hide OSM Paths" : "Show OSM Paths"}
              </Button>
            </>
          )}
          <Button
            variant="primary"
            onClick={onStartDrawing}
            disabled={isDrawing}
            className="w-full"
          >
            <Plus size={18} aria-hidden /> {isDrawing ? "Drawing..." : "Start New Path"}
          </Button>
        </>
      )}
    </div>
  );
}
