'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Búsqueda de paciente con autocomplete ────────────────────────────────────

function PatientSearch({ onSelect }: { onSelect: (p: { id: string; email: string; name: string }) => void }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autocomplete con debounce 300ms
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/proxy/auth/admin/patients?search=${encodeURIComponent(query)}&ordering=name`)
        const data = await res.json()
        setResults(data.results ?? [])
        setOpen(true)
      } finally { setLoading(false) }
    }, 300)
  }, [query])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="mb-4 relative">
      <label className="block text-xs font-semibold text-slate-600 mb-1">Buscar paciente</label>
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          placeholder="Escribe nombre o email del paciente…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 pr-8"
        />
        {loading && (
          <span className="absolute right-3 top-2.5 text-slate-400 text-xs">…</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full border border-slate-200 rounded-lg bg-white shadow-lg overflow-hidden">
          {results.map(p => {
            const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
            const tier = p.plan_tier ?? 'FREE'
            const tierIcon: Record<string,string> = { FREE:'🆓', SILVER:'🥈', GOLD:'🥇', PLATINUM:'💎' }
            return (
              <button
                key={p.id}
                onMouseDown={() => { onSelect({ id: p.id, email: p.email, name }); setQuery(name); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-cyan-50 border-b border-slate-100 last:border-0 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 text-xs font-bold shrink-0">
                  {name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{name}</p>
                  <p className="text-xs text-slate-400 truncate">{p.email}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{tierIcon[tier]} {tier}</span>
              </button>
            )
          })}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full border border-slate-200 rounded-lg bg-white shadow-lg px-3 py-3 text-sm text-slate-400">
          Sin resultados para "{query}"
        </div>
      )}
    </div>
  )
}

// ─── Tab Receta ───────────────────────────────────────────────────────────────

function RxTab() {
  const [patient,   setPatient]   = useState<{ id: string; email: string; name: string } | null>(null)
  const [mode,      setMode]      = useState<'form' | 'pdf'>('form')
  const [doctor,    setDoctor]    = useState('')
  const [notes,     setNotes]     = useState('')
  const [expires,   setExpires]   = useState('')
  const [meds,      setMeds]      = useState([{ name: '', dose: '', instructions: '' }])
  const [pdfFile,   setPdfFile]   = useState<File | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState('')

  function addMed()    { setMeds(m => [...m, { name: '', dose: '', instructions: '' }]) }
  function removeMed(i: number) { setMeds(m => m.filter((_, idx) => idx !== i)) }
  function updateMed(i: number, k: string, v: string) {
    setMeds(m => m.map((med, idx) => idx === i ? { ...med, [k]: v } : med))
  }

  async function send() {
    if (!patient) return alert('Selecciona un paciente')
    setLoading(true); setMsg('')
    try {
      let file_url = ''

      if (mode === 'pdf' && pdfFile) {
        // 1. Obtener presigned URL para el PDF
        const urlRes = await fetch('/api/proxy/documents/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_name: pdfFile.name, mime_type: pdfFile.type }),
        })
        const { upload_url, file_url: fu } = await urlRes.json()
        // 2. Subir a R2
        await fetch(upload_url, { method: 'PUT', body: pdfFile, headers: { 'Content-Type': pdfFile.type } })
        file_url = fu
      }

      const res = await fetch('/api/proxy/auth/admin/prescriptions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id:        patient.id,
          prescribed_by:     doctor,
          notes,
          expires_at:        expires || null,
          file_url,
          medications_listed: mode === 'form'
            ? meds.filter(m => m.name.trim()).map(m => ({ name: m.name, dose: m.dose, instructions: m.instructions }))
            : [],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      setMsg(`✅ Receta enviada a ${patient.name}`)
      setPatient(null); setDoctor(''); setNotes(''); setExpires(''); setPdfFile(null)
      setMeds([{ name: '', dose: '', instructions: '' }])
    } catch (e: any) {
      setMsg(`❌ ${e.message}`)
    } finally { setLoading(false) }
  }

  return (
    <div>
      <PatientSearch onSelect={p => { setPatient(p); setMsg('') }} />

      {patient && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 text-sm text-cyan-800 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-200 flex items-center justify-center text-cyan-700 text-xs font-bold">
            {patient.name[0]?.toUpperCase()}
          </div>
          Paciente: <strong>{patient.name}</strong> — <span className="text-cyan-600">{patient.email}</span>
        </div>
      )}

      {/* Modo: formulario o PDF */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 mb-4 w-fit">
        {(['form','pdf'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            {m === 'form' ? '✏️ Escribir receta' : '📄 Subir PDF'}
          </button>
        ))}
      </div>

      <label className="block text-xs font-semibold text-slate-600 mb-1">Médico / expedidor</label>
      <input value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Dr. Juan García"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-cyan-400" />

      <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / notas del médico</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
        placeholder="Diagnóstico y razón de la receta (la IA lo explicará al paciente)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-cyan-400 resize-none" />

      <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de expiración (opcional)</label>
      <input type="date" value={expires} onChange={e => setExpires(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-cyan-400" />

      {mode === 'pdf' ? (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Archivo PDF de la receta</label>
          <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${pdfFile ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'}`}>
            <input type="file" accept=".pdf,image/*" className="sr-only"
              onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
            {pdfFile ? (
              <span className="text-sm text-cyan-700 font-medium">📄 {pdfFile.name}</span>
            ) : (
              <span className="text-sm text-slate-400">📎 Arrastra o haz clic para seleccionar PDF o imagen</span>
            )}
          </label>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-600">Medicamentos</label>
            <button onClick={addMed} className="text-xs font-bold text-cyan-600 hover:text-cyan-800">+ Agregar</button>
          </div>
          <div className="space-y-2 mb-2">
            {meds.map((m, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input value={m.name} onChange={e => updateMed(i,'name',e.target.value)} placeholder="Medicamento *"
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-cyan-400" />
                <input value={m.dose} onChange={e => updateMed(i,'dose',e.target.value)} placeholder="Dosis"
                  className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                <input value={m.instructions} onChange={e => updateMed(i,'instructions',e.target.value)} placeholder="Instrucciones"
                  className="w-36 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                {meds.length > 1 && (
                  <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 text-xl leading-none pt-0.5">×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className={`px-4 py-3 rounded-lg mt-4 mb-2 text-sm ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg}
        </div>
      )}

      <button onClick={send} disabled={loading || !patient}
        className="w-full mt-4 py-3 rounded-xl font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#00C5E3' }}>
        {loading ? '⏳ Enviando…' : '📋 Enviar receta al paciente'}
      </button>
    </div>
  )
}

// ─── Tab Laboratorio ──────────────────────────────────────────────────────────

function LabTab() {
  const [patient,   setPatient]   = useState<{ id: string; email: string; name: string } | null>(null)
  const [mode,      setMode]      = useState<'form' | 'pdf'>('form')
  const [panelName, setPanelName] = useState('')
  const [labName,   setLabName]   = useState('')
  const [perfAt,    setPerfAt]    = useState('')
  const [pdfFile,   setPdfFile]   = useState<File | null>(null)
  const [results,   setResults]   = useState([{ parameter: '', value: '', unit: '', ref_min: '', ref_max: '' }])
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState('')

  function addResult()     { setResults(r => [...r, { parameter: '', value: '', unit: '', ref_min: '', ref_max: '' }]) }
  function removeResult(i: number) { setResults(r => r.filter((_, idx) => idx !== i)) }
  function updateResult(i: number, k: string, v: string) {
    setResults(r => r.map((res, idx) => idx === i ? { ...res, [k]: v } : res))
  }

  async function send() {
    if (!patient) return alert('Selecciona un paciente')
    setLoading(true); setMsg('')
    try {
      let file_url = ''

      if (mode === 'pdf' && pdfFile) {
        const urlRes = await fetch('/api/proxy/documents/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_name: pdfFile.name, mime_type: pdfFile.type }),
        })
        const { upload_url, file_url: fu } = await urlRes.json()
        await fetch(upload_url, { method: 'PUT', body: pdfFile, headers: { 'Content-Type': pdfFile.type } })
        file_url = fu
      }

      const res = await fetch('/api/proxy/auth/admin/labs/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          panel_name: panelName || 'Resultados de laboratorio',
          lab_name:   labName,
          performed_at: perfAt || new Date().toISOString().split('T')[0],
          file_url,
          results: mode === 'form'
            ? results.filter(r => r.parameter.trim() && r.value.trim()).map(r => ({
                parameter: r.parameter, value: parseFloat(r.value), unit: r.unit,
                ref_min: r.ref_min ? parseFloat(r.ref_min) : null,
                ref_max: r.ref_max ? parseFloat(r.ref_max) : null,
              }))
            : [],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      setMsg(`✅ Resultados enviados a ${patient.name}`)
      setPatient(null); setPanelName(''); setLabName(''); setPerfAt(''); setPdfFile(null)
      setResults([{ parameter: '', value: '', unit: '', ref_min: '', ref_max: '' }])
    } catch (e: any) {
      setMsg(`❌ ${e.message}`)
    } finally { setLoading(false) }
  }

  return (
    <div>
      <PatientSearch onSelect={p => { setPatient(p); setMsg('') }} />

      {patient && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 text-sm text-cyan-800 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-200 flex items-center justify-center text-cyan-700 text-xs font-bold">
            {patient.name[0]?.toUpperCase()}
          </div>
          Paciente: <strong>{patient.name}</strong> — <span className="text-cyan-600">{patient.email}</span>
        </div>
      )}

      {/* Modo */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 mb-4 w-fit">
        {(['form','pdf'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            {m === 'form' ? '✏️ Capturar resultados' : '📄 Subir PDF / imagen'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre del panel</label>
          <input value={panelName} onChange={e => setPanelName(e.target.value)} placeholder="Química 24 elementos"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Laboratorio</label>
          <input value={labName} onChange={e => setLabName(e.target.value)} placeholder="Lab. Chopo"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400" />
        </div>
      </div>

      <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha del estudio</label>
      <input type="date" value={perfAt} onChange={e => setPerfAt(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-cyan-400" />

      {mode === 'pdf' ? (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Archivo (PDF o imagen)</label>
          <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${pdfFile ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'}`}>
            <input type="file" accept=".pdf,image/*" className="sr-only"
              onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
            {pdfFile ? (
              <span className="text-sm text-cyan-700 font-medium">📄 {pdfFile.name}</span>
            ) : (
              <span className="text-sm text-slate-400">📎 Arrastra o haz clic para seleccionar</span>
            )}
          </label>
          <p className="text-xs text-slate-400 mt-1">La IA analizará el archivo directamente.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-600">Parámetros</label>
            <button onClick={addResult} className="text-xs font-bold text-cyan-600 hover:text-cyan-800">+ Agregar parámetro</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  {['Parámetro *','Valor *','Unidad','Ref. min','Ref. max',''].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {(['parameter','value','unit','ref_min','ref_max'] as const).map(k => (
                      <td key={k} className="px-1 py-1">
                        <input value={r[k]} onChange={e => updateResult(i, k, e.target.value)}
                          placeholder={k === 'parameter' ? 'Glucosa' : k === 'value' ? '95' : k === 'unit' ? 'mg/dL' : ''}
                          className="w-full border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-cyan-400" />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      {results.length > 1 && (
                        <button onClick={() => removeResult(i)} className="text-red-400 hover:text-red-600">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {msg && (
        <div className={`px-4 py-3 rounded-lg mt-4 mb-2 text-sm ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg}
        </div>
      )}

      <button onClick={send} disabled={loading || !patient}
        className="w-full mt-4 py-3 rounded-xl font-bold text-white disabled:opacity-40"
        style={{ backgroundColor: '#00C5E3' }}>
        {loading ? '⏳ Enviando…' : '🔬 Enviar resultados al paciente'}
      </button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SendDocsPage() {
  const [tab, setTab] = useState<'rx' | 'lab'>('rx')

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Enviar documentos clínicos</h1>
      <p className="text-sm text-slate-500 mb-6">
        Envía recetas o resultados de laboratorio directamente al paciente. Aparecerán en su app con análisis de IA disponible.
      </p>

      <div className="flex bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        {([['rx', '📋 Receta'], ['lab', '🔬 Laboratorio']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {tab === 'rx' ? <RxTab /> : <LabTab />}
      </div>
    </div>
  )
}
