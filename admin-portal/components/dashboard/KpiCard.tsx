interface KpiCardProps {
  icon:       string
  label:      string
  value:      number | string
  sub?:       string
  accent?:    string  // color del borde izquierdo
  trend?:     'up' | 'down' | 'neutral'
}

export function KpiCard({
  icon,
  label,
  value,
  sub,
  accent = '#00C5E3',
}: KpiCardProps) {
  return (
    <div
      className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-start gap-4"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: `${accent}18` }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}
