/**
 * endpoints.ts
 * ------------
 * Todas las URLs del backend como constantes tipadas.
 * Evita strings mágicos dispersos por la app.
 */

export const EP = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  authMe:                '/auth/me/',
  authInit:              '/auth/init/',  // crea usuario en Django si webhook falló
  me:                    '/auth/me/',
  myRole:                '/auth/me/role/',
  /** Factory para crear perfil por rol: 'patient' | 'doctor' | 'specialist' */
  profileCreate: (role: 'patient' | 'doctor' | 'specialist') =>
    `/auth/profiles/${role}/`,
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
  vitalsDetail: (id: string) => `/vitals/${id}/`,
  vitalsLatest:          '/vitals/latest/',
  vitalsSummary:         '/vitals/summary/',
  vitalsGoals:           '/vitals/goals/',
  vitalsPatient: (id: string) => `/vitals/patient/${id}/`,
  vitalsPatientLatest: (id: string) => `/vitals/patient/${id}/latest/`,

  // ── Medicamentos ──────────────────────────────────────────────────────────
  medications:           '/medications/',
  medicationDetail: (id: string) => `/medications/${id}/`,
  medicationSchedules: (id: string) => `/medications/${id}/schedules/`,
  medicationHistory:     '/medications/history/',
  medicationToday:       '/medications/history/today/',
  medicationTake: (id: string) => `/medications/history/${id}/take/`,
  medicationSkip: (id: string) => `/medications/history/${id}/skip/`,
  medicationPostpone: (id: string) => `/medications/history/${id}/postpone/`,
  medicationsPatient: (id: string) => `/medications/patient/${id}/`,

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
  gamification:             '/gamification/me/',
  gamificationTransactions: '/gamification/me/transactions/',
  badges:                   '/gamification/badges/',
  gamificationRewards:      '/gamification/rewards/',
  gamificationRedeem:       '/gamification/redeem/',
  gamificationRedemptions:  '/gamification/me/redemptions/',
  leaderboard:              '/gamification/leaderboard/',

  // ── Family Care ───────────────────────────────────────────────────────────
  familyCareLinks:       '/family-care/links/',
  familyCareLink: (id: string) => `/family-care/links/${id}/`,
  familyCareLinkAccept: (id: string) => `/family-care/links/${id}/accept/`,
  familyCareLinkRevoke: (id: string) => `/family-care/links/${id}/revoke/`,
  familyCareVitals: (id: string) => `/family-care/links/${id}/vitals/`,
  familyCareAlerts: (id: string) => `/family-care/links/${id}/alerts/`,
  familyCareAlertDispatch: (linkId: string, alertId: string) =>
    `/family-care/links/${linkId}/alerts/${alertId}/dispatch-doctor/`,

  // ── Prescriptions ─────────────────────────────────────────────────────────
  prescriptions:         '/prescriptions/',
  prescriptionDetail: (id: string) => `/prescriptions/${id}/`,

  // ── Wellness ──────────────────────────────────────────────────────────────
  wellnessPrograms:      '/wellness/programs/',
  wellnessProgram: (id: string) => `/wellness/programs/${id}/`,
  wellnessEnrollments:   '/wellness/enrollments/',
  wellnessEnrollment: (id: string) => `/wellness/enrollments/${id}/`,
  wellnessMood:          '/wellness/mood/',
  wellnessSleep:         '/wellness/sleep/',
  wellnessCheckins:      '/wellness/checkins/',

  // ── Analytics ─────────────────────────────────────────────────────────────
  analyticsDashboard:    '/analytics/dashboard/',
  analyticsAdherence:    '/analytics/adherence/',
  analyticsInsights:     '/analytics/insights/',
  analyticsInsightsGenerate: '/analytics/insights/generate/',
  aiAnalyze:             '/analytics/analyze/',

  // ── Especialistas & Referidos ─────────────────────────────────────────────
  specialistsList:       '/specialists/',
  specialistDetail: (id: string) => `/specialists/${id}/`,
  referrals:             '/specialists/referrals/',
  referralsIncoming:     '/specialists/referrals/incoming/',
  referralDetail: (id: string) => `/specialists/referrals/${id}/`,
  referralStatus: (id: string) => `/specialists/referrals/${id}/status/`,

  // ── Health check ─────────────────────────────────────────────────────────
  health:                '/health/',

  // ── Solicitud de contacto (médicos / especialistas) ───────────────────────
  contactRequest:        '/auth/contact-request/',
} as const
