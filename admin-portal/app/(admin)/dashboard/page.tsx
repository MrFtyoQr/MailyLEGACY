'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { EP } from '@/lib/endpoints'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Patient {
  id:               string
  email:            string
  first_name:       string
  last_name:        string
  photo_url:        string | null
  joined_at:        string
  plan_tier:        'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  last_vital_at:    string | null
  vital_count:      number
  medication_count: number
  is_active:        boolean
}

interface PatientListResponse {
  count:   number
  page:    number
  pages:   number
  results: Patient[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  FREE:     '#8E8E93',
  SILVER:   '#5E9FE0',
  GOLD:     '#F5A623',
  PLATINUM: '#9B59B6',
}

const TIER_ICON: Record<string, string> = {
  FREE: '🆓', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎',
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Sin actividad'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins  / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0)  return `hace ${days}d`
  if (hours > 0)  return `hace ${hours}h`
  if (mins  > 0)  return `hace ${mins}min`
  return 'Ahora'
}

function initials(first: string, last: string, email: string): string {
  if (first || last) return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
  return email[0]?.toUpperCase() ?? '?'
}

function getActivityColor(lastVital: string | null): string {
  if (!lastVital) return '#94A3B8'
  const days = (Date.now() - new Date(lastVital).getTime()) / 86_400_000
  if (days <= 1)  return '#10B981'  // verde — activo hoy
  if (days <= 7)  return '#F59E0B'  // amarillo — esta semana
  return '#EF4444'                   // rojo — inactivo
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function Avatar({ patient }: { patient: Patient }) {
  const color = getActivityColor(patient.last_vital_at)
  const text  = initials(patient.first_name, patient.last_name, patient.email)

  return (
    <div className="relative shrink-0">
      {patient.photo_url ? (
        <img
          src={patient.photo_url}
          alt={text}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: '#00C5E3' }}
        >
          {text}
        </div>
      )}
      {/* Dot de actividad */}
      <span
        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
        style={{ backgroundColor: color }}
        title={patient.last_vital_at ? `Último vital: ${timeAgo(patient.last_vital_at)}` : 'Sin registros'}
      />
    </div>
  )
}

function PatientRow({ patient }: { patient: Patient }) {
  const fullName = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || '—'
  const tier     = patient.plan_tier ?? 'FREE'

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Avatar patient={patient} />
          <div>
            <p className="text-sm font-semibold text-slate-800">{fullName}</p>
            <p className="text-xs text-slate-400">{patient.email}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
          style={{ backgroundColor: TIER_COLOR[tier] + '22', color: TIER_COLOR[tier] }}
        >
          {TIER_ICON[tier]} {tier}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {patient.vital_count > 0 ? (
          <span className="flex items-center gap-1">
            <span className="text-base">❤️</span>
            {patient.vital_count} registros
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {patient.medication_count > 0 ? (
          <span className="flex items-center gap-1">
            <span className="text-base">💊</span>
            {patient.medication_count}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <span
          className="text-xs font-medium"
          style={{ color: getActivityColor(patient.last_vital_at) }}
        >
          {timeAgo(patient.last_vital_at)}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-slate-400">
        {new Date(patient.joined_at).toLocaleDateString('es-MX', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </td>
    </tr>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 animate-pulse">
      {[1,2,3,4,5,6].map(i => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 bg-slate-100 rounded w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [search,   setSearch]   = useState('')
  const [ordering, setOrdering] = useState('last_activity')
  const [page,     setPage]     = useState(1)

  const { data, isLoading, error, refetch } = useQuery<PatientListResponse>({
    queryKey:  ['admin-patients', search, ordering, page],
    staleTime: 30_000,
    queryFn:   () => apiGet<PatientListResponse>(EP.adminPatients, async () => null, {
      search:   search || undefined,
      ordering,
      page,
    }),
  })

  const patients = data?.results ?? []
  const total    = data?.count   ?? 0
  const pages    = data?.pages   ?? 1

  // Stats rápidas de la lista actual
  const activeToday = patients.filter(p => {
    if (!p.last_vital_at) return false
    return (Date.now() - new Date(p.last_vital_at).getTime()) < 86_400_000
  }).length

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitoreo de Pacientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total > 0 ? `${total} pacientes registrados` : 'Cargando…'}
            {activeToday > 0 && (
              <span className="ml-2 text-emerald-600 font-medium">
                · {activeToday} activos hoy
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white
                     border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          ⚠️ {(error as Error).message}
        </div>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 min-w-[240px] px-4 py-2 text-sm border border-slate-200
                     rounded-lg focus:outline-none focus:border-cyan-400"
        />
        <select
          value={ordering}
          onChange={e => setOrdering(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg
                     focus:outline-none focus:border-cyan-400 bg-white"
        >
          <option value="last_activity">Última actividad</option>
          <option value="name">Nombre A-Z</option>
          <option value="joined">Registro reciente</option>
        </select>
      </div>

      {/* ── Leyenda de estado ──────────────────────────────────────────── */}
      <div className="flex gap-4 mb-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/>
          Activo hoy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"/>
          Esta semana
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"/>
          Inactivo +7 días
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"/>
          Sin registros
        </span>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paciente</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vitales</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Medicamentos</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Última actividad</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : patients.length > 0
              ? patients.map(p => <PatientRow key={p.id} patient={p} />)
              : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                    {search ? `Sin resultados para "${search}"` : 'No hay pacientes registrados aún'}
                  </td>
                </tr>
              )
            }
          </tbody>
        </table>
      </div>

      {/* ── Paginación ─────────────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Página {page} de {pages} · {total} pacientes
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg
                         disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg
                         disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
