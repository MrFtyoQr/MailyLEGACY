'use client'

import { useState, useMemo } from 'react'
import { useQueryClient }    from '@tanstack/react-query'
import { useUsers, type AdminUser } from '@/hooks/useUsers'
import { EP } from '@/lib/endpoints'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  FREE: '#8E8E93', SILVER: '#5E9FE0', GOLD: '#F5A623', PLATINUM: '#9B59B6',
}
const TIER_ICON: Record<string, string> = {
  FREE: '🆓', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎',
}
const ROLE_COLOR: Record<string, string> = {
  PATIENT: '#F97316', DOCTOR: '#2196F3', SPECIALIST: '#00BFA5',
  ADMIN: '#EF4444', PARTNER: '#8B5CF6',
}

function initials(u: AdminUser) {
  if (u.first_name || u.last_name)
    return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase()
  return u.email[0]?.toUpperCase() ?? '?'
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30)  return `${days} días`
  if (days < 365) return `${Math.floor(days / 30)} meses`
  return `${Math.floor(days / 365)} años`
}

function isBirthdayThisMonth(bd: string | null): boolean {
  if (!bd) return false
  const m = new Date(bd).getUTCMonth()
  return m === new Date().getMonth()
}

// ─── Modal Expedir Licencia ───────────────────────────────────────────────────

function GrantModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [tier,    setTier]    = useState('GOLD')
  const [months,  setMonths]  = useState('3')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error,   setError]   = useState('')
  const qc = useQueryClient()

  async function grant() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/proxy/auth/admin/subscriptions/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, tier, months: parseInt(months) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setSuccess(data.detail)
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Expedir licencia</h3>
        <p className="text-sm text-slate-500 mb-4">{fullName}</p>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm mb-4">
            ✅ {success}
          </div>
        ) : (
          <>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Plan</label>
            <select
              value={tier} onChange={e => setTier(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-cyan-400"
            >
              {['FREE','SILVER','GOLD','PLATINUM'].map(t => (
                <option key={t} value={t}>{TIER_ICON[t]} {t}</option>
              ))}
            </select>

            <label className="block text-xs font-semibold text-slate-600 mb-1">Duración</label>
            <select
              value={months} onChange={e => setMonths(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-cyan-400"
            >
              {[['1','1 mes'],['3','3 meses'],['6','6 meses'],['12','1 año']].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

            <button
              onClick={grant} disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
              style={{ backgroundColor: TIER_COLOR[tier] }}
            >
              {loading ? 'Procesando…' : `Otorgar ${tier}`}
            </button>
          </>
        )}

        <button onClick={onClose} className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700">
          {success ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </div>
  )
}

// ─── Fila de usuario ──────────────────────────────────────────────────────────

function UserRow({ user, onGrant }: { user: AdminUser; onGrant: (u: AdminUser) => void }) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—'
  const bday = user.birth_date
    ? new Date(user.birth_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    : '—'
  const isThisMonth = isBirthdayThisMonth(user.birth_date)

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {user.photo_url ? (
              <img src={user.photo_url} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                   style={{ backgroundColor: ROLE_COLOR[user.role] ?? '#94A3B8' }}>
                {initials(user)}
              </div>
            )}
            {isThisMonth && (
              <span className="absolute -top-1 -right-1 text-xs">🎂</span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{fullName}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ backgroundColor: (ROLE_COLOR[user.role] ?? '#94A3B8') + '22',
                       color: ROLE_COLOR[user.role] ?? '#94A3B8' }}>
          {user.role}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ backgroundColor: TIER_COLOR[user.plan_tier] + '22',
                       color: TIER_COLOR[user.plan_tier] }}>
          {TIER_ICON[user.plan_tier]} {user.plan_tier}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-500">{user.vital_count}</td>
      <td className="py-3 px-4 text-sm text-slate-500">{timeAgo(user.created_at)}</td>
      <td className="py-3 px-4 text-sm text-slate-500">
        {isThisMonth ? <span className="text-amber-600 font-semibold">🎂 {bday}</span> : bday}
      </td>
      <td className="py-3 px-4">
        <button
          onClick={() => onGrant(user)}
          className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors"
          style={{ borderColor: '#00C5E3', color: '#00C5E3' }}
        >
          Licencia
        </button>
      </td>
    </tr>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function UsersPage() {
  const [search,    setSearch]    = useState('')
  const [role,      setRole]      = useState('')
  const [grantUser, setGrantUser] = useState<AdminUser | null>(null)

  const { data, isLoading, error, refetch } = useUsers({
    search:   search || undefined,
    role:     role   || undefined,
  })

  const users = data?.results ?? []

  const birthdayUsers = useMemo(
    () => users.filter(u => isBirthdayThisMonth(u.birth_date)),
    [users]
  )

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {grantUser && <GrantModal user={grantUser} onClose={() => setGrantUser(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.count ?? '—'} usuarios registrados
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          🔄 Actualizar
        </button>
      </div>

      {/* Cumpleaños este mes */}
      {birthdayUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-bold text-amber-800 mb-2">
            🎂 Cumpleaños este mes ({birthdayUsers.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {birthdayUsers.map(u => (
              <span key={u.id} className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded-full">
                {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                {u.birth_date && ` — ${new Date(u.birth_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="text" placeholder="🔍 Buscar por nombre o email…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400" />
        <select value={role} onChange={e => setRole(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-cyan-400">
          <option value="">Todos los roles</option>
          {['PATIENT','DOCTOR','SPECIALIST','ADMIN','PARTNER'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          ⚠️ {(error as Error).message}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Usuario','Rol','Plan','Vitales','Antigüedad','Cumpleaños',''].map(h => (
                <th key={h} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-slate-100 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.length > 0
              ? users.map(u => <UserRow key={u.id} user={u} onGrant={setGrantUser} />)
              : (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm">
                  {search ? `Sin resultados para "${search}"` : 'No hay usuarios'}
                </td></tr>
              )
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
