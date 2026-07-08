export const MAX_LEVEL = 10

/** Umbrales de puntos por nivel (sincronizado con backend + nivel 10) */
export const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 4000, 8000, 15000, 30000, 50000]

export interface LevelMetaText {
  level:       number
  name:        string
  phrase:      string
  accent:      string
  faceColor:   string
  shadowColor: string
}

export const LEVEL_META_TEXT: Record<number, LevelMetaText> = {
  1:  { level: 1,  name: 'Brote',    phrase: 'El viaje comienza.',                                      accent: '#8B6914', faceColor: '#FFFBF0', shadowColor: '#E8D5B0' },
  2:  { level: 2,  name: 'Hoja',     phrase: 'Has despertado la conciencia de tu salud.',               accent: '#2D8A4E', faceColor: '#F0FDF4', shadowColor: '#BBF7D0' },
  3:  { level: 3,  name: 'Trébol',   phrase: 'Tu compromiso empieza a dar frutos.',                      accent: '#1F7A3D', faceColor: '#ECFDF5', shadowColor: '#A7F3D0' },
  4:  { level: 4,  name: 'Gota',     phrase: 'La constancia fluye en cada una de tus acciones.',         accent: '#0E7C9E', faceColor: '#F0F9FF', shadowColor: '#BAE6FD' },
  5:  { level: 5,  name: 'Estrella', phrase: 'Brillas por encima de tus propios límites.',               accent: '#D97706', faceColor: '#FFFBEB', shadowColor: '#FDE68A' },
  6:  { level: 6,  name: 'Cristal',  phrase: 'La sabiduría del autocuidado guía tu camino.',            accent: '#7C3AED', faceColor: '#FAF5FF', shadowColor: '#E9D5FF' },
  7:  { level: 7,  name: 'Escudo',   phrase: 'Te has convertido en protector de tu bienestar.',         accent: '#B45309', faceColor: '#FFFBEB', shadowColor: '#FCD34D' },
  8:  { level: 8,  name: 'Trofeo',   phrase: 'La disciplina te ha llevado a la victoria.',              accent: '#CA8A04', faceColor: '#FEFCE8', shadowColor: '#FEF08A' },
  9:  { level: 9,  name: 'Llama',    phrase: 'Tu dedicación arde con fuerza inquebrantable.',           accent: '#EA580C', faceColor: '#FFF7ED', shadowColor: '#FED7AA' },
  10: { level: 10, name: 'Diamante', phrase: 'Tu legado de salud permanecerá para siempre.',            accent: '#0891B2', faceColor: '#ECFEFF', shadowColor: '#A5F3FC' },
}

export function clampLevel(level: number): number {
  return Math.min(Math.max(Math.round(level), 1), MAX_LEVEL)
}

export function getLevelProgress(totalPoints: number, level: number) {
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextThreshold    = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  if (level >= MAX_LEVEL) return { pct: 1, current: totalPoints, needed: 0 }
  const range = nextThreshold - currentThreshold
  const done  = totalPoints - currentThreshold
  return {
    pct:     Math.min(Math.max(done / range, 0), 1),
    current: done,
    needed:  nextThreshold - totalPoints,
  }
}

export const LAST_SEEN_LEVEL_KEY = '@maily_last_seen_level'
