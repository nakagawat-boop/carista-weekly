'use client'
interface KpiCardProps { label:string; value:string|number; unit:string; color:string; badge?:string }
export default function KpiCard({ label, value, unit, color, badge }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border p-4 relative overflow-hidden" style={{borderColor:'var(--border)'}}>
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-full" style={{background:color}} />
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs font-semibold" style={{color:'var(--text-light)'}}>{label}</span>
        {badge && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{background:'#e8f2ff',color:'var(--accent)'}}>{badge}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-sm font-medium" style={{color:'var(--text-light)'}}>{unit}</span>
      </div>
    </div>
  )
}
