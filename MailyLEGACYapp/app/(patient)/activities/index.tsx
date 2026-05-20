/**
 * (patient)/activities/index.tsx
 * Actividades y bienestar: check-in diario (ánimo + sueño), programas inscritos.
 * Notificaciones de recordatorio vía WebSocket (conectadas al store).
 */

import React, { useState } from 'react'
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card }          from '@components/ui/Card'
import { Badge }         from '@components/ui/Badge'
import { Skeleton }      from '@components/ui/Skeleton'
import { Colors }        from '@constants/colors'
import { get, post }     from '@lib/api/client'
import { EP }            from '@lib/api/endpoints'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface DailyCheckin {
  id:         string
  date:       string
  mood_score: number
  sleep_hours: number
  notes:      string | null
}

interface Enrollment {
  id:           string
  program_name: string
  status:       'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  started_at:   string
  completed_at: string | null
  progress_pct: number
}

interface MoodEntry {
  id:         string
  score:      number
  notes:      string | null
  recorded_at: string
}

// ── Emojis de ánimo ───────────────────────────────────────────────────────────
const MOOD_EMOJIS: Record<number, string> = {
  1: '😞', 2: '😟', 3: '😕', 4: '🙁', 5: '😐',
  6: '🙂', 7: '😊', 8: '😄', 9: '😁', 10: '🤩',
}

const MOOD_COLOR = (score: number) => {
  if (score <= 3) return Colors.semantic.error
  if (score <= 6) return Colors.semantic.warning
  return Colors.semantic.success
}

const SLEEP_EMOJIS = ['😴', '💤', '🌙', '⭐', '🌟']

/** Django devuelve microsegundos en el ISO string — iOS no los parsea. */
function safeDate(iso: string): Date {
  return new Date(iso.replace(/\.\d{1,6}(?=[+-Z]|$)/, ''))
}

export default function ActivitiesScreen() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing]   = useState(false)

  // Formulario check-in
  const [moodScore,   setMoodScore]   = useState(7)
  const [sleepHours,  setSleepHours]  = useState(7)
  const [notes,       setNotes]       = useState('')
  const [submitted,   setSubmitted]   = useState(false)

  const checkinsQ = useQuery<{ results: DailyCheckin[] }>({
    queryKey:  ['wellness-checkins'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<{ results: DailyCheckin[] }>(EP.wellnessCheckins),
  })

  const enrollmentsQ = useQuery<{ results: Enrollment[] }>({
    queryKey:  ['wellness-enrollments'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<{ results: Enrollment[] }>(EP.wellnessEnrollments),
  })

  const moodQ = useQuery<{ results: MoodEntry[] }>({
    queryKey:  ['wellness-mood'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<{ results: MoodEntry[] }>(EP.wellnessMood),
  })

  // DailyCheckin es solo lectura — el backend lo genera automáticamente
  // cuando se guardan MoodEntry + SleepEntry.
  const checkinMutation = useMutation({
    mutationFn: async () => {
      const now   = new Date()
      const today = now.toISOString().split('T')[0]

      // Derivar label de ánimo a partir del score
      const moodLabel =
        moodScore >= 9 ? 'EXCELLENT' :
        moodScore >= 7 ? 'GOOD'      :
        moodScore >= 5 ? 'NEUTRAL'   :
        moodScore >= 3 ? 'LOW'       : 'SAD'

      // Derivar calidad de sueño a partir de horas
      const sleepQuality =
        sleepHours >= 8 ? 'GREAT' :
        sleepHours >= 7 ? 'GOOD'  :
        sleepHours >= 5 ? 'FAIR'  :
        sleepHours >= 3 ? 'POOR'  : 'INSOMNIA'

      // Mood: puede haber múltiples por día — si falla, propagamos el error
      await post(EP.wellnessMood, {
        logged_at: now.toISOString(),
        score:     moodScore,
        label:     moodLabel,
        note:      notes.trim() || '',
      })

      // Sleep: unique_together (patient, sleep_date) — si ya existe hoy, ignoramos el error
      try {
        await post(EP.wellnessSleep, {
          sleep_date:     today,
          duration_hours: sleepHours,
          quality:        sleepQuality,
          note:           notes.trim() || '',
        })
      } catch {
        // Ya registrado hoy — DailyCheckin se actualiza igual desde el mood entry
      }
    },
    onSuccess: () => {
      setSubmitted(true)
      queryClient.invalidateQueries({ queryKey: ['wellness-checkins'] })
      queryClient.invalidateQueries({ queryKey: ['wellness-mood'] })
      queryClient.invalidateQueries({ queryKey: ['wellness-sleep'] })
    },
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      checkinsQ.refetch(),
      enrollmentsQ.refetch(),
      moodQ.refetch(),
    ])
    setRefreshing(false)
  }

  // Verificar si ya hizo check-in hoy
  const today = new Date().toISOString().split('T')[0]
  const todayCheckin  = checkinsQ.data?.results?.find((c) => c.date === today)
  const sleepDoneToday = !!todayCheckin?.sleep_hours
  const alreadyDone   = !!todayCheckin || submitted

  // Promedio de ánimo de la semana
  const moodEntries  = moodQ.data?.results?.slice(0, 7) ?? []
  const avgMood      = moodEntries.length > 0
    ? Math.round(moodEntries.reduce((s, e) => s + e.score, 0) / moodEntries.length)
    : null

  const enrollments  = enrollmentsQ.data?.results ?? []
  const active       = enrollments.filter((e) => e.status === 'ACTIVE')

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏃 Actividades</Text>
        {avgMood != null && (
          <View style={styles.moodBadge}>
            <Text style={styles.moodBadgeText}>
              {MOOD_EMOJIS[avgMood]} Ánimo promedio: {avgMood}/10
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* ── Check-in diario ── */}
        <Text style={styles.sectionLabel}>Check-in de hoy</Text>

        {alreadyDone ? (
          <Card style={styles.doneCard}>
            <Text style={styles.doneEmoji}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.doneTitle}>¡Check-in de ánimo completado!</Text>
              <Text style={styles.doneSub}>
                Ánimo: {MOOD_EMOJIS[todayCheckin?.mood_score ?? moodScore]}{' '}
                {todayCheckin?.mood_score ?? moodScore}/10
                {'  ·  '}
                Sueño: {todayCheckin?.sleep_hours ?? sleepHours}h
              </Text>
              {sleepDoneToday && (
                <Text style={styles.sleepNote}>
                  💤 Sueño de hoy registrado — próxima anotación: mañana a partir de las 00:00
                </Text>
              )}
            </View>
          </Card>
        ) : (
          <Card style={styles.checkinCard}>
            {/* Ánimo */}
            <Text style={styles.fieldLabel}>¿Cómo te sientes? {MOOD_EMOJIS[moodScore]}</Text>
            <View style={styles.moodSlider}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setMoodScore(n)}
                  style={[
                    styles.moodBtn,
                    moodScore === n && { backgroundColor: MOOD_COLOR(n) },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.moodBtnText,
                    moodScore === n && styles.moodBtnTextActive,
                  ]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Horas de sueño */}
            <Text style={styles.fieldLabel}>
              ¿Cuántas horas dormiste? {SLEEP_EMOJIS[Math.min(Math.floor(sleepHours / 2), 4)]} {sleepHours}h
            </Text>
            <View style={styles.sleepSlider}>
              {[4, 5, 6, 7, 8, 9, 10].map((h) => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setSleepHours(h)}
                  style={[
                    styles.sleepBtn,
                    sleepHours === h && styles.sleepBtnActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sleepBtnText,
                    sleepHours === h && styles.sleepBtnTextActive,
                  ]}>
                    {h}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notas */}
            <TextInput
              style={styles.notesInput}
              placeholder="Notas adicionales (opcional)…"
              placeholderTextColor={Colors.light.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.submitBtn, checkinMutation.isPending && styles.submitBtnDisabled]}
              onPress={() => checkinMutation.mutate()}
              activeOpacity={0.85}
              disabled={checkinMutation.isPending}
            >
              <Text style={styles.submitBtnText}>
                {checkinMutation.isPending ? 'Guardando…' : 'Registrar check-in'}
              </Text>
            </TouchableOpacity>

            {checkinMutation.isError && (
              <Text style={styles.errorText}>No se pudo guardar. Intenta de nuevo.</Text>
            )}
          </Card>
        )}

        {/* ── Ánimo de la semana ── */}
        {moodEntries.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Ánimo — últimos 7 días</Text>
            <Card style={styles.moodWeekCard}>
              <View style={styles.moodWeekRow}>
                {moodEntries.slice(0, 7).reverse().map((entry) => (
                  <View key={entry.id} style={styles.moodDay}>
                    <Text style={styles.moodDayEmoji}>{MOOD_EMOJIS[entry.score]}</Text>
                    <Text style={[styles.moodDayScore, { color: MOOD_COLOR(entry.score) }]}>
                      {entry.score}
                    </Text>
                    <Text style={styles.moodDayDate}>
                      {safeDate(entry.recorded_at).toLocaleDateString('es-MX', { weekday: 'short' })}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}

        {/* ── Programas inscritos ── */}
        <Text style={styles.sectionLabel}>Mis programas</Text>
        {enrollmentsQ.isLoading ? (
          <Skeleton height={90} borderRadius={16} style={{ marginBottom: 12 }} />
        ) : active.length > 0 ? (
          active.map((e) => (
            <Card key={e.id} style={styles.programCard}>
              <View style={styles.programHeader}>
                <Text style={styles.programName} numberOfLines={1}>{e.program_name}</Text>
                <Badge label="Activo" variant="success" size="sm" />
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${e.progress_pct}%` as `${number}%` }]} />
              </View>
              <Text style={styles.progressLabel}>{e.progress_pct}% completado</Text>
              <Text style={styles.programDate}>
                Inicio: {safeDate(e.started_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
              </Text>
            </Card>
          ))
        ) : (
          <View style={styles.emptyPrograms}>
            <Text style={styles.emptyProgramsEmoji}>🌱</Text>
            <Text style={styles.emptyProgramsText}>Sin programas activos</Text>
            <Text style={styles.emptyProgramsSub}>
              Tu médico puede inscribirte en programas de bienestar personalizados.
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.textPrimary, marginBottom: 4 },
  moodBadge: {
    alignSelf:       'flex-start',
    backgroundColor: Colors.light.surface,
    borderRadius:    20,
    paddingHorizontal: 12,
    paddingVertical:  5,
  },
  moodBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },

  sectionLabel: {
    fontSize:     13,
    fontWeight:   '700',
    color:        Colors.light.textMuted,
    marginBottom: 10,
    marginTop:    20,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  doneCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  doneEmoji: { fontSize: 32 },
  doneTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  doneSub:   { fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  sleepNote: { fontSize: 12, color: Colors.light.textMuted, marginTop: 6, lineHeight: 17 },

  checkinCard: { gap: 14 },
  fieldLabel:  { fontSize: 14, fontWeight: '600', color: Colors.light.textPrimary },

  moodSlider: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: Colors.light.surface,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.light.border,
  },
  moodBtnText:       { fontSize: 12, fontWeight: '700', color: Colors.light.textMuted },
  moodBtnTextActive: { color: '#FFFFFF' },

  sleepSlider: { flexDirection: 'row', justifyContent: 'space-between' },
  sleepBtn: {
    paddingHorizontal: 8,
    paddingVertical:   6,
    borderRadius:      10,
    backgroundColor:   Colors.light.surface,
    borderWidth:       1,
    borderColor:       Colors.light.border,
  },
  sleepBtnActive:    { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
  sleepBtnText:      { fontSize: 12, fontWeight: '600', color: Colors.light.textMuted },
  sleepBtnTextActive:{ color: '#FFFFFF' },

  notesInput: {
    backgroundColor: Colors.light.surface,
    borderRadius:    12,
    padding:         12,
    minHeight:       70,
    color:           Colors.light.textPrimary,
    fontSize:        14,
    textAlignVertical: 'top',
  },

  submitBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  errorText:     { fontSize: 13, color: Colors.semantic.error, textAlign: 'center' },

  moodWeekCard: {},
  moodWeekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  moodDay:    { alignItems: 'center', gap: 4 },
  moodDayEmoji: { fontSize: 20 },
  moodDayScore: { fontSize: 13, fontWeight: '700' },
  moodDayDate:  { fontSize: 10, color: Colors.light.textMuted, textTransform: 'capitalize' },

  programCard:   { marginBottom: 12, gap: 6 },
  programHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  programName:   { fontSize: 15, fontWeight: '700', color: Colors.light.textPrimary, flex: 1 },
  progressTrack: {
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.light.surface,
    overflow:        'hidden',
    marginTop:       4,
  },
  progressFill: {
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.brand.primary,
  },
  progressLabel: { fontSize: 12, color: Colors.light.textMuted },
  programDate:   { fontSize: 12, color: Colors.light.textMuted },

  emptyPrograms:    { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyProgramsEmoji: { fontSize: 40 },
  emptyProgramsText:  { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  emptyProgramsSub:   { fontSize: 13, color: Colors.light.textMuted, textAlign: 'center', lineHeight: 20 },
})
