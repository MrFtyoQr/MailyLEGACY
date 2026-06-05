/**
 * Endpoints del backend — espejo del endpoints.ts del móvil
 * Solo los que usa el portal de administración.
 */

export const EP = {
  // Auth
  me:               '/auth/me/',
  adminDashboard:   '/auth/admin/dashboard/',
  adminUsers:       '/auth/admin/users/',
  adminUser: (id: string) => `/auth/admin/users/${id}/`,
  adminPatients:    '/auth/admin/patients/',
  adminGrantSub:    '/auth/admin/subscriptions/grant/',
  adminSendRx:      '/auth/admin/prescriptions/send/',
  adminSendLab:     '/auth/admin/labs/send/',
  adminSpecialists: '/auth/admin/specialists/',
  adminSpecialistVerify: (id: string) => `/auth/admin/specialists/${id}/verify/`,

  // Audit log
  audit:            '/audit/',

  // Specialists (Fase 2)
  specialists:      '/specialists/',
  specialist: (id: string) => `/specialists/${id}/`,
} as const
