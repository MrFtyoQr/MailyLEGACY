/**
 * api.types.ts
 * ------------
 * Tipos TypeScript que reflejan las respuestas del backend Django.
 * Basado en los serializers de la API REST.
 */

import { UserRole } from '@constants/config'

// ---------------------------------------------------------------------------
// Auth / Users
// ---------------------------------------------------------------------------

export interface BackendUser {
  id:         string
  clerk_id:   string | null   // Nullable — usuarios nativos no tienen clerk_id
  email:      string
  role:       UserRole | null
  is_active:  boolean
  created_at: string
}

export interface BaseProfile {
  id:         string
  user:       string   // UUID
  first_name: string
  last_name:  string
  photo_url:  string | null
  phone:      string | null
  created_at: string
  updated_at: string
}

export interface PatientProfile extends BaseProfile {
  birth_date:        string | null
  blood_type:        string | null
  allergies:         string | null
  chronic_conditions: string | null
  emergency_contact_name:  string | null
  emergency_contact_phone: string | null
}

export interface DoctorProfile extends BaseProfile {
  license_number:  string
  specialty:       string
  bio:             string | null
  consultation_fee: string | null
  accepts_family_care: boolean
}

export interface SpecialistProfile extends BaseProfile {
  specialty_type:  string
  license_number:  string
  bio:             string | null
  organization:    string | null
}

export interface MeResponse {
  user:        BackendUser
  profile:     BaseProfile | PatientProfile | DoctorProfile | SpecialistProfile | null
  is_complete: boolean
}

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------

export interface VitalSign {
  id:            string
  patient:       string
  glucose_mgdl:  number | null
  heart_rate:    number | null
  systolic_bp:   number | null
  diastolic_bp:  number | null
  temperature_c: number | null
  weight_kg:     number | null
  notes:         string | null
  recorded_at:   string
  created_at:    string
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

export interface Medication {
  id:          string
  patient:     string
  name:        string
  dosage:      string
  frequency:   string
  start_date:  string
  end_date:    string | null
  is_active:   boolean
  notes:       string | null
  prescribed_by: string | null
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Appointment {
  id:              string
  patient:         string
  doctor:          string | null
  specialist:      string | null
  scheduled_at:    string
  duration_minutes: number
  status:          AppointmentStatus
  reason:          string | null
  notes:           string | null
  video_room_url:  string | null
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationCode =
  | 'VITAL_ALERT_HIGH'
  | 'VITAL_ALERT_LOW'
  | 'MEDICATION_REMINDER'
  | 'APPOINTMENT_REMINDER'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'DOCTOR_MESSAGE'
  | 'FAMILY_CARE_REQUEST'
  | 'FAMILY_VITAL_REMINDER'
  | 'FAMILY_DOCTOR_DISPATCHED'
  | 'FAMILY_PAYMENT_RECEIVED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'

export interface Notification {
  id:          string
  user:        string
  code:        NotificationCode
  title:       string
  body:        string
  data:        Record<string, unknown>
  is_read:     boolean
  created_at:  string
}

// ---------------------------------------------------------------------------
// Family Care
// ---------------------------------------------------------------------------

export type FamilyCareStatus = 'PENDING' | 'ACTIVE' | 'REVOKED'

export interface FamilyCareLink {
  id:           string
  patient:      string
  caregiver:    string   // UUID del usuario con rol PATIENT que cuida
  relation:     string
  status:       FamilyCareStatus
  permissions:  string[]
  created_at:   string
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  count:    number
  next:     string | null
  previous: string | null
  results:  T[]
}

// ---------------------------------------------------------------------------
// Generic API response
// ---------------------------------------------------------------------------

export interface ApiSuccessResponse<T = unknown> {
  data: T
  message?: string
}
