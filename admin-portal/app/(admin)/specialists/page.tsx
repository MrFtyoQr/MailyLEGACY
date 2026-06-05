'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSpecialists, type AdminSpecialist } from '@/hooks/useSpecialists'
import { EP } from '@/lib/endpoints'

const STATUS_COLOR: Record<string, string> = {
  PENDING:  '#F59E0B',
  VERIFIED: '#10B981',
  REJECTED: '#EF4444',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: '⏳ Pendiente', VERIFIED: '✅ Verificado', REJECTED: '❌ Rechazado',
}

const SPECIALTY_LABEL: Record<string, string> = {
  CARDIOLOGY: 'Cardiología', ENDOCRINOLOGY: 'Endocrinología',
  NEUROLOGY: 'Neurología', DERMATOLOGY: 'Dermatología',
  GYNECOLOGY: 'Ginecología', PEDIATRICS: 'Pediatría',
  PSYCHIATRY: 'Psiquiatría', ORTHOPEDICS: 'Ortopedia',
  OPHTHALMOLOGY: 'Oftalmología', NUTRITION: 'Nutrición',
  LABORATORY: 'Laboratorio', IMAGING: 'Imagen',
  CLINIC: 'Clínica', PHARMACY: 'Farmacia', OTHER: 'Otro',
}

function SpecialistRow({ sp, onAction }: {
  sp: AdminSpecialist
  onAction: (sp: AdminSpecialist, action: 'VERIFIED' | 'REJECTED') => void
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {sp.avatar_url ? (
            <img src={sp.avatar_url} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
              {sp.name[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800">{sp.name}</p>
            <p className="text-xs text-slate-400">{sp.email}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {SPECIALTY_LABEL[sp.specialty_area] ?? sp.specialty_area}
      </td>
      <td className="py-3 px-4 text-sm text-slate-500">
        {sp.license_number || '—'}
      </td>
      <td className="py-3 px-4">
        <span className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[sp.verification_status] + '22',
                       color: STATUS_COLOR[sp.verification_status] }}>
          {STATUS_LABEL[sp.verification_status]}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-slate-400">
        {new Date(sp.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="py-3 px-4">
        {sp.verification_status === 'PENDING' && (
          <div className="flex gap-2">
            <button onClick={() => onAction(sp, 'VERIFIED')}
              className="px-2 py-1 text-xs font-bold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
              ✅ Verificar
            </button>
            <button onClick={() => onAction(sp, 'REJECTED')}
              className="px-2 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
              ❌ Rechazar
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function SpecialistsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [msg,          setMsg]          = useState('')
  const qc = useQueryClient()

  const { data, isLoading, error, refetch } = useSpecialists({
    status: statusFilter || undefined,
    search: search       || undefined,
  })

  const specialists = data?.results ?? []
  const pending = specialists.filter(s => s.verification_status === 'PENDING').length

  async function handleAction(sp: AdminSpecialist, action: 'VERIFIED' | 'REJECTED') {
    const label = action === 'VERIFIED' ? 'verificar' : 'rechazar'
    if (!confirm(`¿Deseas ${label} a ${sp.name}?`)) return
    setLoading(true); setMsg('')
    try {
      const res = await fetch(`/api/proxy/auth/admin/specialists/${sp.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      setMsg(`✅ ${sp.name} ${action === 'VERIFIED' ? 'verificado' : 'rechazado'}`)
      qc.invalidateQueries({ queryKey: ['admin-specialists'] })
    } catch (e: any) {
      setMsg(`❌ ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Especialistas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.count ?? '—'} registrados
            {pending > 0 && <span className="ml-2 text-amber-600 font-semibold">· {pending} pendientes</span>}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          🔄 Actualizar
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg mb-4 text-sm ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="text" placeholder="🔍 Buscar…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none">
          <option value="">Todos los estados</option>
          {['PENDING','VERIFIED','REJECTED'].map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          ⚠️ {(error as Error).message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Especialista','Área','Cédula','Estado','Registrado','Acciones'].map(h => (
                <th key={h} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              : specialists.length > 0
              ? specialists.map(sp => <SpecialistRow key={sp.id} sp={sp} onAction={handleAction} />)
              : (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                  Sin especialistas registrados
                </td></tr>
              )
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
