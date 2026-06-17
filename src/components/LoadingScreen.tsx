import { Loader2 } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div
      role="status"
      className="absolute inset-0 z-50 bg-surface flex flex-col items-center justify-center gap-4"
    >
      <Loader2 className="animate-spin text-on-surface" size={48} aria-hidden />
      <p className="ds-label-md text-on-surface-variant">Connecting...</p>
    </div>
  );
}
