import { AlertTriangle } from 'lucide-react';

export default function PostureAlertBanner({ issues }) {
  return (
    <div className="absolute inset-x-4 top-4 z-10 bg-red-600/95 backdrop-blur rounded-xl px-4 py-3 flex items-start gap-3 shadow-lg animate-pulse">
      <AlertTriangle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-white font-semibold text-sm">Исправьте осанку!</p>
        {issues?.length > 0 && (
          <ul className="text-white/90 text-xs mt-1 space-y-0.5">
            {issues.map(i => <li key={i}>• {i}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}