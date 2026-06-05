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

// ─── Modal: Agregar especialista ──────────────────────────────────────────────

const SPECIALTIES = [
  ['CARDIOLOGY','Cardiología'],['ENDOCRINOLOGY','Endocrinología'],
  ['NEUROLOGY','Neurología'],['DERMATOLOGY','Dermatología'],
  ['GYNECOLOGY','Ginecología'],['PEDIATRICS','Pediatría'],
  ['PSYCHIATRY','Psiquiatría'],['ORTHOPEDICS','Ortopedia'],
  ['OPHTHALMOLOGY','Oftalmología'],['NUTRITION','Nutrición'],
  ['LABORATORY','Laboratorio'],['IMAGING','Imagen diagnóstica'],
  ['CLINIC','Clínica general'],['PHARMACY','Farmacia'],['OTHER','Otro'],
]

function AddSpecialistModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', specialty_area: 'OTHER',
    specialist_type: 'DOCTOR', license_number: '', bio: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.name.trim()) return setError('El nombre es requerido')
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/proxy/auth/admin/specialists/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, verification_status: 'VERIFIED' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(d))
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900 mb-4">➕ Agregar especialista</h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          {[['name','Nombre completo *','text'],['email','Email','email'],['phone','Teléfono','tel'],['license_number','Cédula profesional','text']].map(([k,l,t]) => (
            <div key={k} className={k === 'name' ? 'col-span-2' : ''}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{l}</label>
              <input type={t} value={(form as any)[k]} onChange={e => update(k, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
            <select value={form.specialist_type} onChange={e => update('specialist_type', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              {[['DOCTOR','Médico'],['LAB','Laboratorio'],['CLINIC','Clínica'],['PHARMACY','Farmacia'],['OTHER','Otro']].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Especialidad</label>
            <select value={form.specialty_area} onChange={e => update('specialty_area', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              {SPECIALTIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción / bio (opcional)</label>
        <textarea value={form.bio} onChange={e => update('bio', e.target.value)} rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-cyan-400 resize-none" />

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={save} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: '#00C5E3' }}>
            {loading ? 'Guardando…' : 'Agregar especialista'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SpecialistsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [msg,          setMsg]          = useState('')
  const [showAdd,      setShowAdd]      = useState(false)
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
      {showAdd && (
        <AddSpecialistModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); setMsg('✅ Especialista agregado correctamente'); qc.invalidateQueries({ queryKey: ['admin-specialists'] }) }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Especialistas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.count ?? '—'} registrados
            {pending > 0 && <span className="ml-2 text-amber-600 font-semibold">· {pending} pendientes</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm font-bold text-white rounded-lg"
            style={{ backgroundColor: '#00C5E3' }}>
            ➕ Agregar
          </button>
          <button onClick={() => refetch()} disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            🔄 Actualizar
          </button>
        </div>
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
