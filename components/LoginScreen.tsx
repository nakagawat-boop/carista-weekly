'use client'
import { CA_NAMES, CaName, ADMIN } from '@/types'
interface Props { onLogin: (name: CaName) => void }
export default function LoginScreen({ onLogin }: Props) {
  const members = CA_NAMES.filter(n => n !== ADMIN)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(15,23,42,0.6)',backdropFilter:'blur(24px)'}}>
      <div className="slide-up bg-white rounded-2xl p-10 w-[380px] text-center" style={{boxShadow:'var(--shadow-lg)'}}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl" style={{background:'linear-gradient(135deg,var(--accent),var(--purple))'}}>
          <span className="text-white">C</span>
        </div>
        <h1 className="text-xl font-extrabold tracking-tight mb-1" style={{color:'var(--text)'}}>Carista Weekly</h1>
        <p className="text-sm mb-8" style={{color:'var(--text-tertiary)'}}>ログインするユーザーを選択</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {members.map(name => (
            <button key={name} onClick={() => onLogin(name)} className="py-3.5 rounded-xl border font-semibold text-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-light)]" style={{borderColor:'var(--border)',color:'var(--text)'}}>
              {name}
            </button>
          ))}
        </div>
        <button onClick={() => onLogin(ADMIN)} className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all" style={{background:'var(--accent)',boxShadow:'var(--shadow-accent)'}}>
          {ADMIN}（管理者）
        </button>
      </div>
    </div>
  )
}
