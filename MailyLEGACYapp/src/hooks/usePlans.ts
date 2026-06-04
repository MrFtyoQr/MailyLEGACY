/**
 * usePlans.ts
 * -----------
 * Queries para planes de suscripción y checkout.
 * Endpoints: GET /payments/plans/  |  GET /payments/subscription/
 *            POST /payments/checkout/  |  POST /payments/cancel/
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PlanTier = 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM'
export type PlanMode = 'individual' | 'family'

export interface PlanFeature {
  label: string
  included: boolean
  highlight?: boolean
}

export interface Plan {
  id: string
  name: string
  tier: PlanTier
  mode: PlanMode
  priceMonthly: number        // precio en USD
  priceAnnual?: number        // precio anual (descuento)
  currency: string
  stripePriceId: string
  features: PlanFeature[]
  maxFamilyMembers?: number   // solo para family
  popular?: boolean
}

export interface Subscription {
  plan: { id: string; name: string; tier: PlanTier; mode: PlanMode } | null
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface CheckoutInput {
  planId: string
  successUrl?: string
  cancelUrl?: string
}

export interface CheckoutResult {
  checkoutUrl: string
}

// ─── Beneficios locales por tier ──────────────────────────────────────────────
// Se usan cuando el backend no devuelve features (fallback UI)

const FEATURE_MATRIX: Record<PlanTier, PlanFeature[]> = {
  FREE: [
    { label: 'Registro de signos vitales (3/día)', included: true },
    { label: 'Recordatorios de medicamentos', included: true },
    { label: 'Historial clínico básico', included: true },
    { label: 'Citas médicas (ver)', included: true },
    { label: 'Documentos (5 archivos)', included: true },
    { label: 'Miembros familiares', included: false },
    { label: 'Análisis de IA', included: false },
    { label: 'Resultados de laboratorio', included: false },
    { label: 'Programas de bienestar', included: false },
  ],
  SILVER: [
    { label: 'Signos vitales ilimitados', included: true, highlight: true },
    { label: 'Recordatorios de medicamentos', included: true },
    { label: 'Historial clínico completo', included: true },
    { label: 'Agendar y gestionar citas', included: true, highlight: true },
    { label: 'Documentos (50 archivos)', included: true },
    { label: '1 miembro familiar', included: true, highlight: true },
    { label: 'Análisis de IA básico', included: true },
    { label: 'Resultados de laboratorio', included: true },
    { label: 'Programas de bienestar (3)', included: true },
  ],
  GOLD: [
    { label: 'Signos vitales ilimitados', included: true },
    { label: 'Recordatorios inteligentes', included: true },
    { label: 'Historial clínico + exportar PDF', included: true, highlight: true },
    { label: 'Citas + teleconsulta', included: true, highlight: true },
    { label: 'Documentos ilimitados', included: true },
    { label: 'Hasta 3 miembros familiares', included: true, highlight: true },
    { label: 'Análisis de IA avanzado', included: true, highlight: true },
    { label: 'Laboratorios + alertas críticas', included: true },
    { label: 'Todos los programas de bienestar', included: true },
  ],
  PLATINUM: [
    { label: 'Todo lo de Gold incluido', included: true },
    { label: 'Hasta 6 miembros familiares', included: true, highlight: true },
    { label: 'Análisis de IA premium + insights', included: true, highlight: true },
    { label: 'Soporte prioritario 24/7', included: true, highlight: true },
    { label: 'Especialistas sin referido', included: true, highlight: true },
    { label: 'Gamificación y recompensas premium', included: true },
    { label: 'Exportación completa de datos', included: true },
    { label: 'Acceso anticipado a funciones', included: true },
    { label: 'Consultor de salud personal', included: true, highlight: true },
  ],
}

export { FEATURE_MATRIX }

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Lista todos los planes disponibles desde el backend */
export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ['plans'],
    staleTime: 10 * 60_000,   // 10 min — los planes no cambian seguido
    retry: 1,
    queryFn: () => get<Plan[]>(EP.plans),
  })
}

/** Suscripción activa del usuario actual */
export function useSubscription() {
  return useQuery<Subscription>({
    queryKey: ['subscription'],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => get<Subscription>(EP.subscription),
  })
}

/** Inicia checkout con Stripe — devuelve URL de pago */
export function useCheckout() {
  return useMutation<CheckoutResult, Error, CheckoutInput>({
    mutationFn: (input) => post<CheckoutResult>(EP.checkout, input),
  })
}

/** Cancela la suscripción activa */
export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: () => post<void>(EP.cancelSubscription, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}
