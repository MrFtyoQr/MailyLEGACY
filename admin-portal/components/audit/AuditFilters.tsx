'use client'

import { useState } from 'react'
import type { AuditFilters } from '@/types'

// Common action values from the backend
const ACTIONS = [
  'VITAL_LOGGED',
  'MED_TAKEN',
  'MED_SKIPPED',
  'MED_POSTPONED',
  'APPOINTMENT_CREATED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_COMPLETED',
  'LAB_UPLOADED',
  'DOCUMENT_UPLOADED',
  'REFERRAL_CREATED',
  'REFERRAL_ACCEPTED',
  'REFERRAL_COMPLETED',
  'SLEEP_LOGGED',
  'MOOD_LOGGED',
  'CHECKIN_COMPLETED',
  'PROFILE_UPDATED',
  'LOGIN',
  'LOGOUT',
]

interface Props {
  filters:    AuditFilters
  onChange:   (f: AuditFilters) => void
  isLoading?: boolean
}

export function AuditFilters({ filters, onChange, isLoading }: Props) {
  const [local, setLocal] = useState<AuditFilters>(filters)

  function apply() {
    onChange({ ...local, page: 1 })
  }

  function clear() {
    const reset: AuditFilters = { page: 1 }
    setLocal(reset)
    onChange(reset)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') apply()
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Action select */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-slate-500">Acción</label>
          <select
            value={local.action ?? ''}
            onChange={(e) => setLocal({ ...local, action: e.target.value || undefined })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white
                       text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            <option value="">Todas las acciones</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Actor email */}
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-500">Email del actor</label>
          <input
            type="email"
            value={local.actor_email ?? ''}
            onChange={(e) => setLocal({ ...local, actor_email: e.target.value || undefined })}
            onKeyDown={handleKey}
            placeholder="user@example.com"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white
                       text-slate-800 placeholder-slate-400 focus:outline-none
                       focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {/* Resource type */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-slate-500">Tipo de recurso</label>
          <input
            type="text"
            value={local.resource_type ?? ''}
            onChange={(e) => setLocal({ ...local, resource_type: e.target.value || undefined })}
            onKeyDown={handleKey}
            placeholder="ej. VitalSign"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white
                       text-slate-800 placeholder-slate-400 focus:outline-none
                       focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Desde</label>
          <input
            type="date"
            value={local.date_from ?? ''}
            onChange={(e) => setLocal({ ...local, date_from: e.target.value || undefined })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white
                       text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Hasta</label>
          <input
            type="date"
            value={local.date_to ?? ''}
            onChange={(e) => setLocal({ ...local, date_to: e.target.value || undefined })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white
                       text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={clear}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700
                       border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Limpiar
          </button>
          <button
            onClick={apply}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg
                       transition-colors disabled:opacity-50"
            style={{ background: '#00C5E3' }}
          >
            Buscar
          </button>
        </div>
      </div>
    </div>
  )
}
