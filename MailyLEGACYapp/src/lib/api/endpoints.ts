/**
 * endpoints.ts
 * ------------
 * Todas las URLs del backend como constantes tipadas.
 * Evita strings mágicos dispersos por la app.
 */

export const EP = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  authMe:                '/api/v1/auth/me/',
  me:                    '/auth/me/',
  myRole:                '/auth/me/role/',
  /** Factory para crear perfil por rol: 'patient' | 'doctor' | 'specialist' */
  profileCreate: (role: 'patient' | 'doctor' | 'specialist') =>
    `/api/v1/auth/profiles/${role}/`,
  profilePatient:        '/auth/profiles/patient/',
  profilePatientPhoto:   '/auth/profiles/patient/photo/',
  profileDoctor:         '/auth/profiles/doctor/',
  profileDoctorPhoto:    '/auth/profiles/doctor/photo/',
  profileSpecialist:     '/auth/profiles/specialist/',
  profilePartner:        '/auth/profiles/partner/',
  doctorPatients:        '/auth/doctor/patients/',
  doctorPatient: (id: string) => `/auth/doctor/patients/${id}/`,

  // ── Vitales ───────────────────────────────────────────────────────────────
  vitals:                '/vitals/',
  vitalsLatest:          '/vitals/latest/',
  vitalsSummary:         '/vitals/summary/',
  vitalsGoals:           '/vitals/goals/',
  vitalsPatient: (id: string) => `/vitals/patient/${id}/`,

  // ── Medicamentos ──────────────────────────────────────────────────────────
  medications:           '/medications/',
  medicationHistory:     '/medications/history/',
  medicationToday:       '/medications/history/today/',
  medicationTake: (id: string) => `/medications/history/${id}/take/`,
  medicationSkip: (id: string) => `/medications/history/${id}/skip/`,
  medicationPostpone: (id: string) => `/medications/history/${id}/postpone/`,

  // ── Citas ─────────────────────────────────────────────────────────────────
  appointments:          '/appointments/',
  appointment: (id: string) => `/appointments/${id}/`,
  appointmentCancel: (id: string) => `/appointments/${id}/cancel/`,
  appointmentConfirm: (id: string) => `/appointments/${id}/confirm/`,
  appointmentComplete: (id: string) => `/appointments/${id}/complete/`,
  appointmentNotes: (id: string) => `/appointments/${id}/notes/`,
  appointmentsDoctor:    '/appointments/doctor/',

  // ── Notificaciones ────────────────────────────────────────────────────────
  notifications:         '/notifications/',
  notificationsUnread:   '/notifications/unread-count/',
  notificationsReadAll:  '/notifications/read-all/',
  notificationRead: (id: string) => `/notifications/${id}/read/`,
  deviceToken:           '/notifications/device-token/',
  deviceTokenDelete: (id: string) => `/notifications/device-token/${id}/`,

  // ── Chat ──────────────────────────────────────────────────────────────────
  conversations:         '/chat/',
  conversationUnread:    '/chat/unread-count/',
  conversationRead: (id: string) => `/chat/${id}/read/`,
  messages: (id: string) => `/chat/${id}/messages/`,

  // ── Pagos ─────────────────────────────────────────────────────────────────
  plans:                 '/payments/plans/',
  subscription:          '/payments/subscription/',
  checkout:              '/payments/checkout/',
  portal:                '/payments/portal/',
  cancelSubscription:    '/payments/cancel/',

  // ── Lab Results ───────────────────────────────────────────────────────────
  labs:                  '/labs/',
  labsAbnormal:          '/labs/abnormal/',
  labsSummary:           '/labs/summary/',
  labsPatient: (id: string) => `/labs/patient/${id}/`,

  // ── Documentos ───────────────────────────────────────────────────────────
  documents:             '/documents/',
  documentUploadUrl:     '/documents/upload-url/',
  documentExport:        '/documents/export/',

  // ── Gamificación ─────────────────────────────────────────────────────────
  gamification:          '/gamification/me/',
  badges:                '/gamification/badges/',
  leaderboard:           '/gamification/leaderboard/',

  // ── Family Care ───────────────────────────────────────────────────────────
  familyCareLinks:       '/family-care/links/',
  familyCareLink: (id: string) => `/family-care/links/${id}/`,
  familyCareLinkAccept: (id: string) => `/family-care/links/${id}/accept/`,
  familyCareLinkRevoke: (id: string) => `/family-care/links/${id}/revoke/`,
  familyCareVitals: (id: string) => `/family-care/links/${id}/vitals/`,
  familyCareAlerts: (id: string) => `/family-care/links/${id}/alerts/`,
  familyCareAlertDispatch: (linkId: string, alertId: string) =>
    `/family-care/links/${linkId}/alerts/${alertId}/dispatch-doctor/`,

  // ── Analytics ─────────────────────────────────────────────────────────────
  analyticsDashboard:    '/analytics/dashboard/',
  analyticsAdherence:    '/analytics/adherence/',

  // ── Health check ─────────────────────────────────────────────────────────
  health:                '/health/',
} as const
