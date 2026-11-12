import { Card, CardContent } from '@/components/ui/card';

const STATUS_STYLES = {
  ok: { badge: 'bg-emerald-100 text-emerald-700', label: 'Норма', bar: 'bg-emerald-500' },
  warn: { badge: 'bg-amber-100 text-amber-700', label: 'Внимание', bar: 'bg-amber-500' },
  bad: { badge: 'bg-red-100 text-red-700', label: 'Ошибка', bar: 'bg-red-500' },
  none: { badge: 'bg-slate-100 text-slate-500', label: '—', bar: 'bg-slate-200' },
};

export default function MetricCard({ metric, value, status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.none;
  const progress = value == null ? 0 : Math.min(100, (value / (metric.warn * 1.5)) * 100);

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-medium text-slate-500">{metric.label}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.badge}`}>{s.label}</span>
        </div>
        <p className="text-xl font-bold text-slate-800">
          {value == null ? '—' : `${value.toFixed(0)}${metric.unit || '°'}`}
        </p>
        <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${s.bar}`} style={{ width: `${progress}%` }} />
        </div>
        {status === 'bad' && <p className="text-xs text-red-600 mt-2">{metric.hint}</p>}
      </CardContent>
    </Card>
  );
}