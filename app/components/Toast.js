import { CheckCircle } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold transition-all ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}`}
    >
      {toast.type !== 'error' && <CheckCircle size={14} />}
      {toast.msg}
    </div>
  );
}
