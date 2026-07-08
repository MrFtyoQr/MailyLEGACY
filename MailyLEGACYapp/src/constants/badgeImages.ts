import type { ImageSourcePropType } from 'react-native'

export type BadgeCategory =
  | 'ADHERENCE'
  | 'STREAK'
  | 'VITALS'
  | 'MILESTONE'
  | 'SOCIAL'

export type BadgeCode =
  | 'ADHERENCE_1' | 'ADHERENCE_10' | 'ADHERENCE_50' | 'ADHERENCE_100' | 'ADHERENCE_500'
  | 'STREAK_7' | 'STREAK_14' | 'STREAK_30' | 'STREAK_60' | 'STREAK_90'
  | 'VITALS_5' | 'VITALS_20' | 'VITALS_50'
  | 'POINTS_500' | 'POINTS_1000' | 'POINTS_5000' | 'POINTS_10000'
  | 'REFERRAL_1' | 'REFERRAL_5'

export interface BadgeCatalogEntry {
  code:        BadgeCode
  name:        string
  description: string
  category:    BadgeCategory
  threshold:   number
}

/** Catálogo local — sincronizado con seed_badges.py */
export const BADGE_CATALOG: BadgeCatalogEntry[] = [
  { code: 'ADHERENCE_1',   name: 'Primera dosis',         description: 'Tomaste tu primer medicamento.',        category: 'ADHERENCE', threshold: 1 },
  { code: 'ADHERENCE_10',  name: '10 dosis cumplidas',    description: 'Has tomado 10 dosis correctamente.',   category: 'ADHERENCE', threshold: 10 },
  { code: 'ADHERENCE_50',  name: '50 dosis cumplidas',    description: '50 dosis sin fallar. ¡Excelente!',     category: 'ADHERENCE', threshold: 50 },
  { code: 'ADHERENCE_100', name: '100 dosis cumplidas',   description: '100 dosis. Eres un ejemplo.',          category: 'ADHERENCE', threshold: 100 },
  { code: 'ADHERENCE_500', name: '500 dosis cumplidas',   description: 'Dedicación total a tu salud.',         category: 'ADHERENCE', threshold: 500 },
  { code: 'STREAK_7',      name: 'Racha de 7 días',       description: '7 días consecutivos tomando tu medicamento.', category: 'STREAK', threshold: 7 },
  { code: 'STREAK_14',     name: 'Racha de 14 días',      description: '2 semanas sin interrupciones.',                category: 'STREAK', threshold: 14 },
  { code: 'STREAK_30',     name: 'Racha de 30 días',      description: 'Un mes de adherencia perfecta.',               category: 'STREAK', threshold: 30 },
  { code: 'STREAK_60',     name: 'Racha de 60 días',      description: '60 días. Convertiste la salud en hábito.',    category: 'STREAK', threshold: 60 },
  { code: 'STREAK_90',     name: 'Racha de 90 días',      description: '90 días. Leyenda de la adherencia.',          category: 'STREAK', threshold: 90 },
  { code: 'VITALS_5',      name: 'Monitor activo',        description: 'Registraste 5 signos vitales.',  category: 'VITALS', threshold: 5 },
  { code: 'VITALS_20',     name: 'Monitor dedicado',      description: '20 registros de signos vitales.', category: 'VITALS', threshold: 20 },
  { code: 'VITALS_50',     name: 'Monitor experto',       description: '50 registros. Conoces tu cuerpo.', category: 'VITALS', threshold: 50 },
  { code: 'POINTS_500',    name: '500 puntos',            description: 'Alcanzaste 500 puntos.',      category: 'MILESTONE', threshold: 500 },
  { code: 'POINTS_1000',   name: '1,000 puntos',          description: '1,000 puntos acumulados.',    category: 'MILESTONE', threshold: 1000 },
  { code: 'POINTS_5000',   name: '5,000 puntos',          description: '5,000 puntos. Nivel élite.',  category: 'MILESTONE', threshold: 5000 },
  { code: 'POINTS_10000',  name: '10,000 puntos',         description: '10,000 puntos. Leyenda.',     category: 'MILESTONE', threshold: 10000 },
  { code: 'REFERRAL_1',    name: 'Primer especialista',   description: 'Completaste tu primera consulta con un especialista.', category: 'SOCIAL', threshold: 1 },
  { code: 'REFERRAL_5',    name: 'Red de especialistas',  description: '5 consultas con especialistas completadas.', category: 'SOCIAL', threshold: 5 },
]

export const BADGE_CATEGORY_LABEL: Record<BadgeCategory, string> = {
  ADHERENCE: 'Adherencia',
  STREAK:    'Rachas',
  VITALS:    'Signos vitales',
  MILESTONE: 'Hitos de puntos',
  SOCIAL:    'Especialistas',
}

const BADGE_IMAGES: Record<BadgeCode, ImageSourcePropType> = {
  ADHERENCE_1:   require('../../assets/images/badges/adherence_1.png'),
  ADHERENCE_10:  require('../../assets/images/badges/adherence_10.png'),
  ADHERENCE_50:  require('../../assets/images/badges/adherence_50.png'),
  ADHERENCE_100: require('../../assets/images/badges/adherence_100.png'),
  ADHERENCE_500: require('../../assets/images/badges/adherence_500.png'),
  STREAK_7:      require('../../assets/images/badges/streak_7.png'),
  STREAK_14:     require('../../assets/images/badges/streak_14.png'),
  STREAK_30:     require('../../assets/images/badges/streak_30.png'),
  STREAK_60:     require('../../assets/images/badges/streak_60.png'),
  STREAK_90:     require('../../assets/images/badges/streak_90.png'),
  VITALS_5:      require('../../assets/images/badges/vitals_5.png'),
  VITALS_20:     require('../../assets/images/badges/vitals_20.png'),
  VITALS_50:     require('../../assets/images/badges/vitals_50.png'),
  POINTS_500:    require('../../assets/images/badges/points_500.png'),
  POINTS_1000:   require('../../assets/images/badges/points_1000.png'),
  POINTS_5000:   require('../../assets/images/badges/points_5000.png'),
  POINTS_10000:  require('../../assets/images/badges/points_10000.png'),
  REFERRAL_1:    require('../../assets/images/badges/referral_1.png'),
  REFERRAL_5:    require('../../assets/images/badges/referral_5.png'),
}

export function getBadgeImage(code: string): ImageSourcePropType | null {
  return (BADGE_IMAGES as Record<string, ImageSourcePropType>)[code] ?? null
}

export function isBadgeCode(code: string): code is BadgeCode {
  return code in BADGE_IMAGES
}

/** Escala solo del arte (el contenedor mantiene `size`). */
export const BADGE_IMAGE_SCALE: Partial<Record<BadgeCode, number>> = {
  STREAK_7:  0.5,
  STREAK_14: 2 / 3,
}

export function getBadgeImageScale(code: string): number {
  return BADGE_IMAGE_SCALE[code as BadgeCode] ?? 1
}

export const BADGE_CATEGORY_THEME: Record<BadgeCategory, { accent: string }> = {
  ADHERENCE: { accent: '#2D8A4E' },
  STREAK:    { accent: '#EA580C' },
  VITALS:    { accent: '#0E7C9E' },
  MILESTONE: { accent: '#CA8A04' },
  SOCIAL:    { accent: '#6366F1' },
}

const CATALOG_BY_CODE = Object.fromEntries(
  BADGE_CATALOG.map((entry) => [entry.code, entry]),
) as Record<BadgeCode, BadgeCatalogEntry>

export function getBadgeCatalogEntry(code: string): BadgeCatalogEntry | null {
  return (CATALOG_BY_CODE as Record<string, BadgeCatalogEntry>)[code] ?? null
}

export function getBadgeAccent(code: string, category?: string): string {
  const entry = getBadgeCatalogEntry(code)
  const cat = (entry?.category ?? category) as BadgeCategory | undefined
  if (cat && BADGE_CATEGORY_THEME[cat]) {
    return BADGE_CATEGORY_THEME[cat].accent
  }
  return '#00C5E3'
}

/** Texto descriptivo del requisito para la tarjeta de logro (tiempo pasado al desbloquear). */
export function getBadgeUnlockReason(code: string): string {
  const entry = getBadgeCatalogEntry(code)
  if (!entry) {
    return 'Ganaste esta insignia por tu constancia en el cuidado de tu salud.'
  }

  const n = entry.threshold
  const fmt = (num: number) => num.toLocaleString('es-MX')

  switch (entry.category) {
    case 'ADHERENCE':
      return n === 1
        ? 'Ganaste esta insignia por completar tu primera dosis.'
        : `Ganaste esta insignia por completar ${fmt(n)} dosis tomadas.`
    case 'STREAK':
      return `Ganaste esta insignia por mantener una racha de ${fmt(n)} días con tu medicamento.`
    case 'VITALS':
      return n === 1
        ? 'Ganaste esta insignia por registrar tu primer signo vital.'
        : `Ganaste esta insignia por registrar ${fmt(n)} signos vitales.`
    case 'MILESTONE':
      return `Ganaste esta insignia por acumular ${fmt(n)} puntos.`
    case 'SOCIAL':
      return n === 1
        ? 'Ganaste esta insignia por completar tu primera consulta con un especialista.'
        : `Ganaste esta insignia por completar ${fmt(n)} consultas con especialistas.`
    default:
      return entry.description
  }
}

export const LAST_SEEN_BADGE_CODES_KEY = '@maily_seen_badge_codes'
