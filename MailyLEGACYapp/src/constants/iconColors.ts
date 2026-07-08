/**
 * iconColors.ts
 * -------------
 * Color semántico por icono: tono principal + fondo tintado suave
 * para dar profundidad visual sin exagerar.
 */

import type { AppIconName } from '@components/ui/AppIcon'
import { shadeColor } from './duoTheme'

export interface IconColorSet {
  color: string
  bg:    string
  /** Fondo tintado para tarjetas de información */
  card:  string
  shadow:string
}

const BASE: Partial<Record<AppIconName, IconColorSet>> = {
  pill:           { color: '#6C63FF', bg: '#EEEDFF', card: '#F5F4FF', shadow: '#D8D5FF' },
  fire:           { color: '#F8A600', bg: '#FFF4DB', card: '#FFFAED', shadow: '#FFE4A8' },
  chart:          { color: '#3B82F6', bg: '#DBEAFE', card: '#EFF6FF', shadow: '#BFDBFE' },
  robot:          { color: '#0A6E7A', bg: '#D1FAF5', card: '#ECFDFB', shadow: '#99F0E4' },
  calendar:       { color: '#8B5CF6', bg: '#EDE9FE', card: '#F5F3FF', shadow: '#DDD6FE' },
  heart:          { color: '#EF4444', bg: '#FEE2E2', card: '#FEF2F2', shadow: '#FECACA' },
  lungs:          { color: '#06B6D4', bg: '#CFFAFE', card: '#ECFEFF', shadow: '#A5F3FC' },
  wind:           { color: '#0EA5E9', bg: '#E0F2FE', card: '#F0F9FF', shadow: '#BAE6FD' },
  droplet:        { color: '#3B82F6', bg: '#DBEAFE', card: '#EFF6FF', shadow: '#BFDBFE' },
  nutrition:      { color: '#22C55E', bg: '#DCFCE7', card: '#F0FDF4', shadow: '#BBF7D0' },
  walk:           { color: '#F97316', bg: '#FFEDD5', card: '#FFF7ED', shadow: '#FED7AA' },
  sleep:          { color: '#6366F1', bg: '#E0E7FF', card: '#EEF2FF', shadow: '#C7D2FE' },
  meditation:     { color: '#A855F7', bg: '#F3E8FF', card: '#FAF5FF', shadow: '#E9D5FF' },
  'stretch-neck': { color: '#14B8A6', bg: '#CCFBF1', card: '#F0FDFA', shadow: '#99F6E4' },
  'stretch-chest':{ color: '#14B8A6', bg: '#CCFBF1', card: '#F0FDFA', shadow: '#99F6E4' },
  'stretch-quad': { color: '#14B8A6', bg: '#CCFBF1', card: '#F0FDFA', shadow: '#99F6E4' },
  brain:          { color: '#EC4899', bg: '#FCE7F3', card: '#FDF2F8', shadow: '#FBCFE8' },
  lab:            { color: '#8B5CF6', bg: '#EDE9FE', card: '#F5F3FF', shadow: '#DDD6FE' },
  trend:          { color: '#10B981', bg: '#D1FAE5', card: '#ECFDF5', shadow: '#A7F3D0' },
  user:           { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  bell:           { color: '#F59E0B', bg: '#FEF3C7', card: '#FFFBEB', shadow: '#FDE68A' },
  family:         { color: '#F97316', bg: '#FFEDD5', card: '#FFF7ED', shadow: '#FED7AA' },
  card:           { color: '#0EA5E9', bg: '#E0F2FE', card: '#F0F9FF', shadow: '#BAE6FD' },
  trophy:         { color: '#EAB308', bg: '#FEF9C3', card: '#FEFCE8', shadow: '#FEF08A' },
  settings:       { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  chat:           { color: '#00C5E3', bg: '#CFFAFE', card: '#ECFEFF', shadow: '#A5F3FC' },
  home:           { color: '#00C5E3', bg: '#CFFAFE', card: '#ECFEFF', shadow: '#A5F3FC' },
  microscope:     { color: '#8B5CF6', bg: '#EDE9FE', card: '#F5F3FF', shadow: '#DDD6FE' },
  clipboard:      { color: '#6366F1', bg: '#E0E7FF', card: '#EEF2FF', shadow: '#C7D2FE' },
  run:            { color: '#F97316', bg: '#FFEDD5', card: '#FFF7ED', shadow: '#FED7AA' },
  stethoscope:    { color: '#00BFA5', bg: '#CCFBF1', card: '#F0FDFA', shadow: '#99F6E4' },
  mail:           { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  lock:           { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  doctor:         { color: '#2196F3', bg: '#DBEAFE', card: '#EFF6FF', shadow: '#BFDBFE' },
  hospital:       { color: '#2196F3', bg: '#DBEAFE', card: '#EFF6FF', shadow: '#BFDBFE' },
  users:          { color: '#6366F1', bg: '#E0E7FF', card: '#EEF2FF', shadow: '#C7D2FE' },
  gift:           { color: '#EC4899', bg: '#FCE7F3', card: '#FDF2F8', shadow: '#FBCFE8' },
  medal:          { color: '#EAB308', bg: '#FEF9C3', card: '#FEFCE8', shadow: '#FEF08A' },
  camera:         { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  activity:       { color: '#EF4444', bg: '#FEE2E2', card: '#FEF2F2', shadow: '#FECACA' },
  thermometer:    { color: '#F59E0B', bg: '#FEF3C7', card: '#FFFBEB', shadow: '#FDE68A' },
  footsteps:      { color: '#22C55E', bg: '#DCFCE7', card: '#F0FDF4', shadow: '#BBF7D0' },
  ruler:          { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  syringe:        { color: '#EF4444', bg: '#FEE2E2', card: '#FEF2F2', shadow: '#FECACA' },
  document:       { color: '#6366F1', bg: '#E0E7FF', card: '#EEF2FF', shadow: '#C7D2FE' },
  shield:         { color: '#10B981', bg: '#D1FAE5', card: '#ECFDF5', shadow: '#A7F3D0' },
  trash:          { color: '#EF4444', bg: '#FEE2E2', card: '#FEF2F2', shadow: '#FECACA' },
  note:           { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  sparkles:       { color: '#A855F7', bg: '#F3E8FF', card: '#FAF5FF', shadow: '#E9D5FF' },
  download:       { color: '#3B82F6', bg: '#DBEAFE', card: '#EFF6FF', shadow: '#BFDBFE' },
  folder:         { color: '#F59E0B', bg: '#FEF3C7', card: '#FFFBEB', shadow: '#FDE68A' },
  inbox:          { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  dumbbell:       { color: '#F97316', bg: '#FFEDD5', card: '#FFF7ED', shadow: '#FED7AA' },
  apple:          { color: '#22C55E', bg: '#DCFCE7', card: '#F0FDF4', shadow: '#BBF7D0' },
  plus:           { color: '#00C5E3', bg: '#CFFAFE', card: '#ECFEFF', shadow: '#A5F3FC' },
  'lock-closed':  { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  wave:           { color: '#F59E0B', bg: '#FEF3C7', card: '#FFFBEB', shadow: '#FDE68A' },
  eye:            { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  'eye-off':      { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  'chevron-right':{ color: '#94A3B8', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  scale:          { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  bulb:           { color: '#F59E0B', bg: '#FEF3C7', card: '#FFFBEB', shadow: '#FDE68A' },
  tag:            { color: '#8B5CF6', bg: '#EDE9FE', card: '#F5F3FF', shadow: '#DDD6FE' },
  time:           { color: '#F59E0B', bg: '#FEF3C7', card: '#FFFBEB', shadow: '#FDE68A' },
  refresh:        { color: '#3B82F6', bg: '#DBEAFE', card: '#EFF6FF', shadow: '#BFDBFE' },
  check:          { color: '#10B981', bg: '#D1FAE5', card: '#ECFDF5', shadow: '#A7F3D0' },
  star:           { color: '#EAB308', bg: '#FEF9C3', card: '#FEFCE8', shadow: '#FEF08A' },
  image:          { color: '#6366F1', bg: '#E0E7FF', card: '#EEF2FF', shadow: '#C7D2FE' },
  cog:            { color: '#64748B', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  location:       { color: '#EF4444', bg: '#FEE2E2', card: '#FEF2F2', shadow: '#FECACA' },
  bug:            { color: '#8B5CF6', bg: '#EDE9FE', card: '#F5F3FF', shadow: '#DDD6FE' },
  close:          { color: '#94A3B8', bg: '#F1F5F9', card: '#F8FAFC', shadow: '#E2E8F0' },
  share:          { color: '#00C5E3', bg: '#CFFAFE', card: '#ECFEFF', shadow: '#A5F3FC' },
}

const FALLBACK: IconColorSet = {
  color:  '#64748B',
  bg:     '#F1F5F9',
  card:   '#F8FAFC',
  shadow: '#E2E8F0',
}

/** Paletas pastel limpias para badges de iconos (no para fondo de tarjeta entera) */
export const PASTEL = {
  purple: { icon: '#7B6CF6', bg: '#F0EEFF' },
  orange: { icon: '#F5A623', bg: '#FFF8EB' },
  blue:   { icon: '#4A9EFF', bg: '#EBF5FF' },
  green:  { icon: '#34C759', bg: '#E8FAF0' },
  amber:  { icon: '#FFBA3B', bg: '#FFF8E6' },
  red:    { icon: '#FF6B6B', bg: '#FFEEEE' },
  gray:   { icon: '#94A3B8', bg: '#F1F5F9' },
  teal:   { icon: '#2EC4C6', bg: '#E6FAFA' },
} as const

/** Mapea color semántico de adherencia → pastel */
export function adherencePastel(hex: string): { icon: string; bg: string } {
  if (hex === '#10B981') return PASTEL.green
  if (hex === '#F59E0B') return PASTEL.amber
  if (hex === '#EF4444') return PASTEL.red
  return PASTEL.gray
}

export function getIconColors(name: AppIconName): IconColorSet {
  return BASE[name] ?? FALLBACK
}

/** Genera set de colores a partir de un accent arbitrario (ej. adherencia dinámica) */
export function colorsFromAccent(accent: string): IconColorSet {
  return {
    color:  accent,
    bg:     accent + '20',
    card:   accent + '10',
    shadow: shadeColor(accent, 0.25),
  }
}
