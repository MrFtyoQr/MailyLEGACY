/**
 * AppIcon.tsx
 * -----------
 * Iconos vectoriales (@expo/vector-icons) que reemplazan emojis
 * en toda la app. Estilo limpio, consistente y escalable.
 */

import React from 'react'
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons'
import type { StyleProp, TextStyle } from 'react-native'

export type AppIconName =
  | 'pill' | 'fire' | 'chart' | 'robot' | 'calendar' | 'heart' | 'lungs'
  | 'wind' | 'droplet' | 'nutrition' | 'walk' | 'sleep' | 'meditation'
  | 'stretch-neck' | 'stretch-chest' | 'stretch-quad' | 'brain' | 'lab'
  | 'trend' | 'user' | 'bell' | 'family' | 'card' | 'trophy' | 'settings'
  | 'chat' | 'wave' | 'home' | 'microscope' | 'clipboard' | 'run'
  | 'stethoscope' | 'mail' | 'lock' | 'eye' | 'eye-off' | 'chevron-right'
  | 'plus' | 'folder' | 'gift' | 'camera' | 'lock-closed' | 'medal' | 'download'
  | 'inbox' | 'doctor' | 'hospital' | 'users' | 'apple' | 'dumbbell'
  | 'activity' | 'thermometer' | 'footsteps' | 'ruler' | 'syringe'
  | 'document' | 'shield' | 'trash' | 'note' | 'sparkles'
  | 'scale' | 'bulb' | 'tag' | 'time' | 'refresh' | 'check' | 'star' | 'image' | 'cog'
  | 'location' | 'bug' | 'search' | 'close' | 'share'

type IconSet = 'ion' | 'mci' | 'fa5'

const ICON_MAP: Record<AppIconName, { set: IconSet; name: string }> = {
  pill:           { set: 'mci',  name: 'pill' },
  fire:           { set: 'ion',  name: 'flame' },
  chart:          { set: 'ion',  name: 'bar-chart' },
  robot:          { set: 'mci',  name: 'robot' },
  calendar:       { set: 'ion',  name: 'calendar' },
  heart:          { set: 'ion',  name: 'heart' },
  lungs:          { set: 'mci',  name: 'lungs' },
  wind:           { set: 'mci',  name: 'weather-windy' },
  droplet:        { set: 'ion',  name: 'water' },
  nutrition:      { set: 'mci',  name: 'food-apple' },
  walk:           { set: 'ion',  name: 'walk' },
  sleep:          { set: 'ion',  name: 'moon' },
  meditation:     { set: 'mci',  name: 'meditation' },
  'stretch-neck': { set: 'mci',  name: 'human-handsup' },
  'stretch-chest':{ set: 'mci',  name: 'human' },
  'stretch-quad': { set: 'mci',  name: 'run' },
  brain:          { set: 'mci',  name: 'brain' },
  lab:            { set: 'mci',  name: 'flask' },
  trend:          { set: 'ion',  name: 'trending-up' },
  user:           { set: 'ion',  name: 'person' },
  bell:           { set: 'ion',  name: 'notifications' },
  family:         { set: 'ion',  name: 'people' },
  card:           { set: 'ion',  name: 'card' },
  trophy:         { set: 'ion',  name: 'trophy' },
  settings:       { set: 'ion',  name: 'settings' },
  chat:           { set: 'ion',  name: 'chatbubble' },
  wave:           { set: 'ion',  name: 'hand-left' },
  home:           { set: 'ion',  name: 'home' },
  microscope:     { set: 'mci',  name: 'microscope' },
  clipboard:      { set: 'ion',  name: 'clipboard' },
  run:            { set: 'ion',  name: 'fitness' },
  stethoscope:    { set: 'fa5',  name: 'stethoscope' },
  mail:           { set: 'ion',  name: 'mail' },
  lock:           { set: 'ion',  name: 'lock-closed-outline' },
  eye:            { set: 'ion',  name: 'eye-outline' },
  'eye-off':      { set: 'ion',  name: 'eye-off-outline' },
  'chevron-right':{ set: 'ion',  name: 'chevron-forward' },
  plus:           { set: 'ion',  name: 'add' },
  folder:         { set: 'ion',  name: 'folder' },
  download:       { set: 'ion',  name: 'download' },
  gift:           { set: 'ion',  name: 'gift' },
  camera:         { set: 'ion',  name: 'camera' },
  'lock-closed':  { set: 'ion',  name: 'lock-closed' },
  medal:          { set: 'ion',  name: 'medal' },
  inbox:          { set: 'ion',  name: 'file-tray' },
  doctor:         { set: 'fa5',  name: 'user-md' },
  hospital:       { set: 'fa5',  name: 'hospital' },
  users:          { set: 'ion',  name: 'people' },
  apple:          { set: 'ion',  name: 'nutrition' },
  dumbbell:       { set: 'mci',  name: 'dumbbell' },
  activity:       { set: 'ion',  name: 'pulse' },
  thermometer:    { set: 'mci',  name: 'thermometer' },
  footsteps:      { set: 'ion',  name: 'footsteps' },
  ruler:          { set: 'mci',  name: 'ruler' },
  syringe:        { set: 'mci',  name: 'needle' },
  document:       { set: 'ion',  name: 'document-text' },
  shield:         { set: 'ion',  name: 'shield-checkmark' },
  trash:          { set: 'ion',  name: 'trash' },
  note:           { set: 'ion',  name: 'create' },
  sparkles:       { set: 'ion',  name: 'sparkles' },
  scale:          { set: 'mci',  name: 'scale-bathroom' },
  bulb:           { set: 'ion',  name: 'bulb-outline' },
  tag:            { set: 'ion',  name: 'pricetag' },
  time:           { set: 'ion',  name: 'time-outline' },
  refresh:        { set: 'ion',  name: 'refresh' },
  check:          { set: 'ion',  name: 'checkmark-circle' },
  star:           { set: 'ion',  name: 'star' },
  image:          { set: 'ion',  name: 'image-outline' },
  cog:            { set: 'ion',  name: 'cog' },
  location:       { set: 'ion',  name: 'location-outline' },
  bug:            { set: 'ion',  name: 'bug-outline' },
  search:         { set: 'ion',  name: 'search' },
  close:          { set: 'ion',  name: 'close-circle' },
  share:          { set: 'ion',  name: 'share-social' },
}

/** Mapeo emoji → nombre de icono (compatibilidad con datos existentes) */
export const EMOJI_TO_ICON: Record<string, AppIconName> = {
  '💊': 'pill', '🔥': 'fire', '📊': 'chart', '🤖': 'robot', '📅': 'calendar',
  '💓': 'heart', '❤️': 'heart', '🫁': 'lungs', '🌬️': 'wind', '💧': 'droplet',
  '🥦': 'nutrition', '🚶': 'walk', '😴': 'sleep', '🧘': 'meditation',
  '🫀': 'heart', '🙆': 'stretch-neck', '🤸': 'stretch-chest', '🧎': 'stretch-quad',
  '🧠': 'brain', '🔬': 'lab', '📈': 'trend', '👤': 'user', '🔔': 'bell',
  '👨‍👩‍👧': 'family', '💳': 'card', '🎮': 'trophy', '⚙️': 'settings', '💬': 'chat',
  '👋': 'wave', '🏠': 'home', '🔬': 'lab', '📋': 'clipboard', '🏃': 'run',
  '🩺': 'stethoscope', '🏥': 'hospital', '👥': 'users', '📭': 'inbox',
  '🎁': 'gift', '🏅': 'medal', '🔒': 'lock-closed', '📷': 'camera',
  '👨‍⚕️': 'doctor', '💉': 'syringe', '🌡️': 'thermometer', '🦶': 'footsteps',
  '📏': 'ruler', '📐': 'ruler', '🧪': 'lab', '🛡️': 'shield', '🗑️': 'trash',
  '📝': 'note', '📄': 'document', '🖼️': 'document', '🗂️': 'folder',
  '✅': 'check', '🏆': 'trophy', '🩸': 'syringe', '⚖️': 'scale',
  '🏷️': 'tag', '✉️': 'mail', '⏳': 'time', '🔄': 'refresh', '💡': 'bulb',
  '🩺': 'stethoscope', '🎮': 'trophy', '⚙️': 'cog',
}

interface AppIconProps {
  name?:     AppIconName
  emoji?:    string
  size?:     number
  color?:    string
  style?:    StyleProp<TextStyle>
}

export function AppIcon({ name, emoji, size = 22, color = '#1E293B', style }: AppIconProps) {
  const resolved = name ?? (emoji ? EMOJI_TO_ICON[emoji] : undefined)
  if (!resolved) return null

  const cfg = ICON_MAP[resolved]
  if (!cfg) return null

  const props = { size, color, style }

  switch (cfg.set) {
    case 'mci':
      return <MaterialCommunityIcons name={cfg.name as never} {...props} />
    case 'fa5':
      return <FontAwesome5 name={cfg.name as never} {...props} />
    default:
      return <Ionicons name={cfg.name as never} {...props} />
  }
}
