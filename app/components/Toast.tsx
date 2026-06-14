import { CheckCircle } from "lucide-react";
import type { ToastMessage } from "../types";

export default function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 ds-body-sm font-semibold shadow-[var(--ambient-shadow)] ${
        isError
          ? "bg-error text-on-error"
          : "bg-inverse-surface text-inverse-on-surface"
      }`}
    >
      {!isError && <CheckCircle size={14} aria-hidden />}
      {toast.msg}
    </div>
  );
}
