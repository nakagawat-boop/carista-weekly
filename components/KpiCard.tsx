'use client'
interface KpiCardProps {
  label: string
  value: string | number
  unit: string
  color: string
  badge?: string
  target?: number
}
export default function KpiCard({ label, value, unit, color, badge, target }: KpiCardProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  const pct = target && target > 0 && !isNaN(numValue) ? Math.min((numValue / target) * 100, 100) : null
  return (
    <div className="bg-white rounded-xl border relative overflow-hidden" style={{borderColor:'var(--border)',boxShadow:'var(--shadow-sm)'}}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:color}} />
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{color:'var(--text-tertiary)'}}>{label}</span>
          {badge && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{background:'var(--accent-light)',color:'var(--accent)'}}>{badge}</span>}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[34px] font-extrabold leading-none tracking-tight">{value}</span>
          <span className="text-sm font-medium" style={{color:'var(--text-tertiary)'}}>{unit}</span>
        </div>
        {pct !== null && (
          <div className="mt-3">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{width:`${pct}%`,background:color}} />
            </div>
            <div className="text-right mt-1">
              <span className="text-xs font-bold" style={{color}}>{pct.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
