'use client'

import type { AuditEntry } from '@/types'

function formatDate(iso: string): string {
  const d = new Date(iso.replace(/\.\d{1,6}(?=[+-Z]|$)/, ''))
  return d.toLocaleString('es-MX', {
    day:    '2-digit',
    month:  'short',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: number }) {
  const isError = status >= 400
  const isWarn  = status >= 300 && status < 400
  const bg  = isError ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#D1FAE5'
  const fg  = isError ? '#991B1B' : isWarn ? '#92400E' : '#065F46'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: fg }}
    >
      {status}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    PATIENT:    { bg: '#FEF3C7', fg: '#92400E' },
    DOCTOR:     { bg: '#DBEAFE', fg: '#1E40AF' },
    SPECIALIST: { bg: '#D1FAE5', fg: '#065F46' },
    ADMIN:      { bg: '#E0F7FB', fg: '#006B75' },
    PARTNER:    { bg: '#EDE9FE', fg: '#5B21B6' },
  }
  const { bg, fg } = colors[role] ?? { bg: '#F1F5F9', fg: '#475569' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {role}
    </span>
  )
}

interface Props {
  entries:   AuditEntry[]
  isLoading: boolean
}

export function AuditTable({ entries, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 px-5 flex items-center gap-4 animate-pulse">
              <div className="h-3 w-28 bg-slate-100 rounded" />
              <div className="h-3 w-40 bg-slate-100 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-slate-600 font-medium">No hay registros para los filtros seleccionados</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Fecha
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Actor
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Acción
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Recurso
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                IP
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {entries.map((entry) => {
              const isError = entry.http_status >= 400
              return (
                <tr
                  key={entry.id}
                  className={[
                    'hover:bg-slate-50 transition-colors',
                    isError ? 'bg-red-50/50' : '',
                  ].join(' ')}
                >
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500 text-xs">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-5 py-3 max-w-[200px]">
                    <span className="text-slate-800 truncate block" title={entry.actor_email}>
                      {entry.actor_email}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <RoleBadge role={entry.actor_role} />
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <code className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                      {entry.action}
                    </code>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-600 text-xs">
                    {entry.resource_type}
                    {entry.resource_id && (
                      <span className="text-slate-400 ml-1 font-mono">
                        {entry.resource_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={entry.http_status} />
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs font-mono whitespace-nowrap">
                    {entry.ip_address}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
