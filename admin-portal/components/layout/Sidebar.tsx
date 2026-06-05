'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface NavItem {
  href:  string
  icon:  string
  label: string
  badge?: string // Fase 2 items
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   icon: '🏥', label: 'Pacientes' },
  { href: '/users',       icon: '👥', label: 'Usuarios' },
  { href: '/specialists', icon: '🔬', label: 'Especialistas' },
  { href: '/send-docs',   icon: '📤', label: 'Enviar docs' },
  { href: '/audit',       icon: '📋', label: 'Audit Log' },
]

export function Sidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      router.push('/sign-in')
      router.refresh()
    }
  }

  return (
    <aside
      className="w-60 flex flex-col shrink-0 h-full"
      style={{ background: '#0F172A' }}
    >
      {/* Brand */}
      <div className="px-5 py-6 border-b border-slate-700">
        <h1 className="text-xl font-bold" style={{ color: '#00C5E3' }}>
          MailyT-Cuida
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Portal de administración</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const isPhase2 = Boolean(item.badge)
          return (
            <Link
              key={item.href}
              href={isPhase2 ? '#' : item.href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
                isPhase2 ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
              style={isActive ? { background: '#00C5E3', color: '#fff' } : {}}
              onClick={isPhase2 ? (e) => e.preventDefault() : undefined}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded font-mono">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User / Sign out */}
      <div className="px-4 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-400 truncate mb-3">{adminEmail}</p>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-sm text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2"
        >
          <span>🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
