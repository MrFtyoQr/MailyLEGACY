'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SignInPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    const errParam = searchParams.get('error')
    if (errParam === 'unauthorized') {
      setError('Tu cuenta no tiene permisos de administrador.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión.')
        return
      }

      // Redirigir al dashboard — el server layout verificará la cookie
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Error de conexión. Verifica tu red.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
      style={{ background: '#0F172A' }}
    >
      {/* Logo / brand */}
      <div className="text-center">
        <h1 className="text-3xl font-bold" style={{ color: '#00C5E3' }}>
          MailyT-Cuida
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
          Portal de administración
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl p-6 flex flex-col gap-4"
        style={{ background: '#1E293B', border: '1px solid #334155' }}
      >
        <h2 className="text-white font-semibold text-lg">Iniciar sesión</h2>

        {error && (
          <div
            className="text-sm px-4 py-3 rounded-lg"
            style={{ background: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5' }}
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#94A3B8' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="admin@mailyt.dev"
            className="rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{
              background:   '#0F172A',
              border:       '1px solid #334155',
              color:        '#F1F5F9',
            }}
            onFocus={e => (e.target.style.border = '1px solid #00C5E3')}
            onBlur={e  => (e.target.style.border = '1px solid #334155')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#94A3B8' }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{
              background: '#0F172A',
              border:     '1px solid #334155',
              color:      '#F1F5F9',
            }}
            onFocus={e => (e.target.style.border = '1px solid #00C5E3')}
            onBlur={e  => (e.target.style.border = '1px solid #334155')}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-opacity"
          style={{
            background: loading ? '#0891B2' : '#00C5E3',
            color:      '#0F172A',
            opacity:    loading ? 0.7 : 1,
            cursor:     loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-xs" style={{ color: '#475569' }}>
        Solo usuarios con rol ADMIN tienen acceso.
      </p>
    </div>
  )
}
