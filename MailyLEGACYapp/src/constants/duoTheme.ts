/**
 * duoTheme.ts
 * -----------
 * Tokens del estilo 3D plano (Duolingo): sombras sólidas, sin blur,
 * profundidad por capa inferior del mismo tono más oscuro.
 */

export const DuoDepth = {
  sm: 3,
  md: 4,
  lg: 5,
} as const

/** Oscurece un color hex ~12–18 % para la capa inferior 3D */
export function shadeColor(hex: string, amount = 0.15): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return hex
  const r = Math.max(0, Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export const DuoColors = {
  input: {
    face:   '#F2F2F2',
    shadow: '#D6D6D6',
    border: '#C8C8C8',
  },
  card: {
    face:   '#FAFBFC',
    shadow: '#E2E8F0',
  },
  button: {
    primaryFace:   '#58CCED',
    primaryShadow: '#1899D6',
    primaryText:   '#0A2540',
    secondaryFace:   '#FFFFFF',
    secondaryShadow: '#E2E8F0',
    dangerFace:   '#FF4B4B',
    dangerShadow: '#D33131',
    dangerText:   '#FFFFFF',
  },
  stat: {
    purple: { face: '#FFFFFF', accent: '#6C63FF', shadow: '#E0DEFF' },
    orange: { face: '#FFFFFF', accent: '#F8A600', shadow: '#FFE8B0' },
    green:  { face: '#FFFFFF', accent: '#10B981', shadow: '#C6F6E3' },
  },
} as const
