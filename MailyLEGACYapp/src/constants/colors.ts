export const Colors = {
  brand: {
    primary: '#00C5E3', // cyan — "T-Cuida" text, acciones principales
    warm:    '#F97316', // naranja — cuadrante superior-izq del logo
    hot:     '#E91E8C', // rosa/magenta — cuadrante inferior-izq
    cool:    '#2196F3', // azul — cuadrante superior-der
    nature:  '#00BFA5', // verde/teal — cuadrante inferior-der
  },

  gradients: {
    primary:  ['#2196F3', '#00C5E3'] as const,
    warm:     ['#F97316', '#E91E8C'] as const,
    nature:   ['#00BFA5', '#2196F3'] as const,
    logo:     ['#F97316', '#E91E8C', '#2196F3', '#00C5E3'] as const,
    splash:   ['#0A0F1E', '#131B2E'] as const,
  },

  light: {
    bg:            '#FFFFFF',
    surface:       '#F8FAFC',
    card:          '#FFFFFF',
    border:        '#E2E8F0',
    borderFocus:   '#00C5E3',
    textPrimary:   '#1E293B',
    textSecondary: '#64748B',
    textMuted:     '#94A3B8',
    overlay:       'rgba(0,0,0,0.5)',
  },

  dark: {
    bg:            '#0A0F1E',
    surface:       '#131B2E',
    card:          '#1E2A40',
    border:        '#2D3F5C',
    borderFocus:   '#00C5E3',
    textPrimary:   '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted:     '#64748B',
    overlay:       'rgba(0,0,0,0.7)',
  },

  semantic: {
    success:     '#10B981',
    successBg:   '#D1FAE5',
    warning:     '#F59E0B',
    warningBg:   '#FEF3C7',
    error:       '#EF4444',
    errorBg:     '#FEE2E2',
    info:        '#3B82F6',
    infoBg:      '#DBEAFE',
  },

  // Por rol — usado en role-setup y badges de navegación
  role: {
    patient:    '#F97316', // naranja
    doctor:     '#2196F3', // azul
    specialist: '#00BFA5', // teal
    partner:    '#8B5CF6', // violeta
  },
} as const

export type ColorKey = keyof typeof Colors
