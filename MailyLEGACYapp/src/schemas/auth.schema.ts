/**
 * auth.schema.ts
 * --------------
 * Zod schemas para todos los formularios de autenticación y setup de rol.
 * Mensajes de error en español.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitivos reutilizables
// ---------------------------------------------------------------------------

const emailField = z
  .string({ required_error: 'El correo es obligatorio' })
  .email('Correo electrónico inválido')
  .max(254, 'El correo es demasiado largo')

const passwordField = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres')

const nameField = (label: string) =>
  z
    .string({ required_error: `${label} es obligatorio` })
    .min(1, `${label} no puede estar vacío`)
    .max(100, `${label} es demasiado largo`)

const licenseField = z
  .string({ required_error: 'La cédula profesional es obligatoria' })
  .min(4, 'Cédula profesional inválida')
  .max(50, 'Cédula profesional demasiado larga')
  .regex(/^[A-Z0-9\-]+$/i, 'Solo letras, números y guiones')

// ---------------------------------------------------------------------------
// Sign In
// ---------------------------------------------------------------------------

export const signInSchema = z.object({
  email:    emailField,
  password: passwordField,
})

export type SignInForm = z.infer<typeof signInSchema>

// ---------------------------------------------------------------------------
// Sign Up — paso 1 (datos de cuenta)
// ---------------------------------------------------------------------------

export const signUpSchema = z
  .object({
    email:           emailField,
    password:        passwordField,
    confirmPassword: z.string({ required_error: 'Confirma tu contraseña' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path:    ['confirmPassword'],
  })

export type SignUpForm = z.infer<typeof signUpSchema>

// ---------------------------------------------------------------------------
// Sign Up — paso 2 (verificación de email)
// ---------------------------------------------------------------------------

export const verifyEmailSchema = z.object({
  code: z
    .string({ required_error: 'El código es obligatorio' })
    .length(6, 'El código debe tener 6 dígitos')
    .regex(/^\d{6}$/, 'Solo se permiten dígitos'),
})

export type VerifyEmailForm = z.infer<typeof verifyEmailSchema>

// ---------------------------------------------------------------------------
// Role Setup — discriminated union por rol
// ---------------------------------------------------------------------------

const baseProfile = z.object({
  firstName: nameField('El nombre'),
  lastName:  nameField('El apellido'),
})

export const patientProfileSchema = baseProfile.extend({
  role:      z.literal('PATIENT'),
  birthDate: z
    .string({ required_error: 'La fecha de nacimiento es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (YYYY-MM-DD)'),
})

export const doctorProfileSchema = baseProfile.extend({
  role:          z.literal('DOCTOR'),
  licenseNumber: licenseField,
  specialty:     z
    .string({ required_error: 'La especialidad es obligatoria' })
    .min(2, 'Especialidad inválida')
    .max(100, 'Especialidad demasiado larga'),
})

export const specialistProfileSchema = baseProfile.extend({
  role:          z.literal('SPECIALIST'),
  specialtyType: z
    .string({ required_error: 'El tipo de especialidad es obligatorio' })
    .min(2, 'Tipo de especialidad inválida')
    .max(100, 'Tipo de especialidad demasiado larga'),
  licenseNumber: licenseField,
})

export const roleSetupSchema = z.discriminatedUnion('role', [
  patientProfileSchema,
  doctorProfileSchema,
  specialistProfileSchema,
])

export type RoleSetupForm     = z.infer<typeof roleSetupSchema>
export type PatientProfileForm   = z.infer<typeof patientProfileSchema>
export type DoctorProfileForm    = z.infer<typeof doctorProfileSchema>
export type SpecialistProfileForm = z.infer<typeof specialistProfileSchema>

// ---------------------------------------------------------------------------
// Password strength (solo cliente — no va al backend)
// ---------------------------------------------------------------------------

export function getPasswordStrength(password: string): {
  score:  0 | 1 | 2 | 3 | 4
  label:  string
  color:  string
} {
  let score = 0
  if (password.length >= 8)                  score++
  if (password.length >= 12)                 score++
  if (/[A-Z]/.test(password))               score++
  if (/[0-9]/.test(password))               score++
  if (/[^A-Za-z0-9]/.test(password))        score++

  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4

  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte']
  const colors = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#059669']

  return { score: clamped, label: labels[clamped], color: colors[clamped] }
}
