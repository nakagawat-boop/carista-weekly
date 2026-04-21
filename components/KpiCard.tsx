'use client'
interface KpiCardProps {
  label: string
  value: string | number
  unit: string
  color?: string
  badge?: string
  target?: number
  variant?: 'orange' | 'gold' | 'muted'
}
export default function KpiCard({ label, value, unit, badge, target, variant = 'orange' }: KpiCardProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  const pct = target && target > 0 && !isNaN(numValue) ? Math.min((numValue / target) * 100, 100) : null
  const metricClass = variant === 'gold' ? 'metric metric--gold' : variant === 'muted' ? 'metric metric--muted' : 'metric'
  return (
    <div className={metricClass}>
      <div className="metric__label">
        <span>{label}</span>
        {badge && <span className="tag">{badge}</span>}
      </div>
      <div className="metric__value num">
        <span>{value}</span>
        <span className="metric__unit">{unit}</span>
      </div>
      {pct !== null && (
        <div style={{ marginTop: 12 }}>
          <div className="bar"><div className="bar__fill" style={{ width: `${pct}%` }} /></div>
          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--ink-2)' }}>
            <span className="num">目標 {target}</span>
            <span className="num">{pct.toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
