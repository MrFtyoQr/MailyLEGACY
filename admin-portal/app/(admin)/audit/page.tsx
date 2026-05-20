'use client'

import { useState } from 'react'
import { useAuditLog } from '@/hooks/useAuditLog'
import { AuditFilters } from '@/components/audit/AuditFilters'
import { AuditTable } from '@/components/audit/AuditTable'
import type { AuditFilters as AuditFiltersType } from '@/types'

const PAGE_SIZE = 50

export default function AuditPage() {
  const [filters, setFilters] = useState<AuditFiltersType>({ page: 1 })
  const { data, isLoading, error } = useAuditLog(filters)

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0
  const currentPage = filters.page ?? 1

  function goToPage(p: number) {
    setFilters((f) => ({ ...f, page: p }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="p-8 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Registro inmutable de todas las acciones del sistema
          {data && (
            <span className="ml-2 font-medium text-slate-700">
              ({data.count.toLocaleString('es-MX')} registros)
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        isLoading={isLoading}
      />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          ⚠️ Error al cargar el audit log: {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <AuditTable
        entries={data?.results ?? []}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200
                         rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              ← Anterior
            </button>
            {/* Page numbers — muestra hasta 7 páginas */}
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const page = currentPage <= 4
                ? i + 1
                : i + currentPage - 3
              if (page < 1 || page > totalPages) return null
              return (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  disabled={isLoading}
                  className="w-9 h-8 text-sm font-medium rounded-lg border transition-colors
                             disabled:opacity-40"
                  style={
                    page === currentPage
                      ? { background: '#00C5E3', color: '#fff', borderColor: '#00C5E3' }
                      : { background: '#fff', color: '#475569', borderColor: '#E2E8F0' }
                  }
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200
                         rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
