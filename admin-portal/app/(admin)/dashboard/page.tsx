'use client'

import { useDashboard } from '@/hooks/useDashboard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RoleChart } from '@/components/dashboard/RoleChart'
import { TierChart } from '@/components/dashboard/TierChart'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRolesSub(byRole: Record<string, number>): string {
  const labels: Record<string, string> = {
    PATIENT: 'pac', DOCTOR: 'doc', SPECIALIST: 'esp', PARTNER: 'par',
  }
  return Object.entries(byRole)
    .filter(([k]) => k !== 'ADMIN')
    .map(([k, v]) => `${v} ${labels[k] ?? k}`)
    .join(' · ')
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 animate-pulse"
         style={{ borderLeftWidth: 4, borderLeftColor: '#E2E8F0' }}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-100" />
        <div className="flex-1">
          <div className="h-7 w-16 bg-slate-100 rounded mb-2" />
          <div className="h-4 w-28 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 animate-pulse h-72" />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Resumen de la plataforma en tiempo real
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900
                     bg-white border border-slate-200 rounded-lg hover:bg-slate-50
                     transition-colors disabled:opacity-50"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          ⚠️ Error al cargar datos: {(error as Error).message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data ? (
          <>
            <KpiCard
              icon="👥"
              label="Total usuarios"
              value={data.users.total.toLocaleString('es-MX')}
              sub={getRolesSub(data.users.by_role)}
              accent="#00C5E3"
            />
            <KpiCard
              icon="🏥"
              label="Especialistas pendientes"
              value={data.specialists.pending}
              sub={`${data.specialists.verified} verificados · ${data.specialists.rejected} rechazados`}
              accent={data.specialists.pending > 0 ? '#F59E0B' : '#10B981'}
            />
            <KpiCard
              icon="💳"
              label="Suscripciones activas"
              value={data.subscriptions.active.toLocaleString('es-MX')}
              sub={`${data.referrals.pending} referidos pendientes`}
              accent="#2196F3"
            />
            <KpiCard
              icon="🆕"
              label="Nuevos usuarios hoy"
              value={data.users.new_today}
              sub={`${data.referrals.today} referidos hoy`}
              accent="#10B981"
            />
          </>
        ) : null}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : data ? (
          <>
            <RoleChart byRole={data.users.by_role} />
            <TierChart byTier={data.subscriptions.by_tier} />
          </>
        ) : null}
      </div>

      {/* Specialists quick stats */}
      {data && (
        <div className="mt-6 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            🏥 Estado de especialistas
          </h3>
          <div className="flex gap-6 flex-wrap">
            <Stat label="Total" value={data.specialists.total} color="#64748B" />
            <Stat label="✅ Verificados" value={data.specialists.verified} color="#10B981" />
            <Stat label="⏳ Pendientes" value={data.specialists.pending} color="#F59E0B" />
            <Stat label="❌ Rechazados" value={data.specialists.rejected} color="#EF4444" />
          </div>
          {data.specialists.pending > 0 && (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200
                          px-3 py-2 rounded-lg">
              ⚠️ Hay {data.specialists.pending} especialista(s) pendientes de verificación.
              La gestión estará disponible en Fase 2 del portal.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  )
}
