'use client'
import { CA_NAMES, CaName, ADMIN } from '@/types'
interface Props { onLogin: (name: CaName) => void }
export default function LoginScreen({ onLogin }: Props) {
  const members = CA_NAMES.filter(n => n !== ADMIN)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center tex-noise" style={{ background: 'var(--bg-0)' }}>
      <div className="slide-up" style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--line-2)',
        borderRadius: 'var(--r-3)',
        boxShadow: 'var(--shadow-lg)',
        padding: 44,
        width: 420,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--grad-orange-copper)' }} />
        <div className="eyebrow" style={{ marginBottom: 10 }}>CARISTA · WEEKLY MTG</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 34,
          letterSpacing: '-0.01em',
          margin: '0 0 8px 0',
          lineHeight: 1.1,
          color: 'var(--ink-0)',
        }}>
          <span className="text-gold">Carista</span> Weekly
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', letterSpacing: '0.08em', marginBottom: 28 }}>
          ログインするユーザーを選択してください
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {members.map(name => (
            <button key={name} onClick={() => onLogin(name)} className="btn btn--ghost" style={{
              padding: '14px 0', justifyContent: 'center',
              fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 14, letterSpacing: '0.06em',
            }}>
              {name}
            </button>
          ))}
        </div>
        <button onClick={() => onLogin(ADMIN)} className="btn btn--primary" style={{
          width: '100%', padding: '14px 0', justifyContent: 'center',
          fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 14, letterSpacing: '0.08em',
        }}>
          {ADMIN}（管理者）
        </button>
      </div>
    </div>
  )
}
