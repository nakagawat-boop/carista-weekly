'use client'
import { CA_NAMES, CaName, ADMIN } from '@/types'
interface Props { onLogin: (name: CaName) => void }
export default function LoginScreen({ onLogin }: Props) {
  const members = CA_NAMES.filter(n => n !== ADMIN)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(255,255,255,0.96)',backdropFilter:'blur(20px)'}}>
      <div className="fade-in bg-white rounded-2xl shadow-2xl p-12 w-96 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h1 className="text-xl font-bold mb-1">キャリスター Weekly Dashboard</h1>
        <p className="text-sm mb-8" style={{color:'var(--text-light)'}}>あなたの名前を選んでください</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {members.map(name => (
            <button key={name} onClick={() => onLogin(name)} className="py-3 rounded-xl border-2 font-semibold text-sm transition-all" style={{borderColor:'var(--border)',fontFamily:'var(--font)'}}>{name}</button>
          ))}
        </div>
        <button onClick={() => onLogin(ADMIN)} className="w-full py-3 rounded-xl font-bold text-white text-base" style={{background:'var(--orange)',fontFamily:'var(--font)'}}>👑 {ADMIN}（管理者）</button>
      </div>
    </div>
  )
}
