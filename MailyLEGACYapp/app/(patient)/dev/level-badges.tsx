/**
 * Laboratorio de insignias (solo __DEV__).
 * Previsualiza modales y galería sin acumular puntos reales.
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card } from '@components/ui/Card'
import { LevelBadgeDisplay } from '@components/gamification/LevelBadgeDisplay'
import { LevelUpModal } from '@components/gamification/LevelUpModal'
import { Colors } from '@constants/colors'
import {
  MAX_LEVEL,
  LEVEL_META,
  LAST_SEEN_LEVEL_KEY,
  getLevelMeta,
} from '@constants/levelBadges'
import { formatEarnedDate } from '@lib/gamification/formatEarnedDate'
import { PREVIEW_EARNED_DATES } from '@lib/gamification/levelCelebrationLogic'
import { useAuthStore } from '@store/auth.store'

type PreviewState = {
  level:    number
  earnedAt: string
} | null

export default function LevelBadgesDevLab() {
  const authFirstName = useAuthStore((s) => s.user?.firstName)

  const [previewName, setPreviewName] = useState(authFirstName ?? 'María')
  const [earnedAt, setEarnedAt] = useState(PREVIEW_EARNED_DATES.today())
  const [preview, setPreview] = useState<PreviewState>(null)
  const [storedLevel, setStoredLevel] = useState<string | null>(null)

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/(patient)/gamification')
    }
  }, [])

  const refreshStoredLevel = useCallback(async () => {
    const value = await AsyncStorage.getItem(LAST_SEEN_LEVEL_KEY)
    setStoredLevel(value)
  }, [])

  useEffect(() => {
    if (__DEV__) refreshStoredLevel()
  }, [refreshStoredLevel])

  if (!__DEV__) return null

  function openModal(level: number) {
    setPreview({ level, earnedAt })
  }

  async function setLastSeenLevel(level: number) {
    await AsyncStorage.setItem(LAST_SEEN_LEVEL_KEY, String(level))
    await refreshStoredLevel()
    Alert.alert('Listo', `Último nivel visto fijado en ${level}.`)
  }

  async function clearLastSeenLevel() {
    await AsyncStorage.removeItem(LAST_SEEN_LEVEL_KEY)
    await refreshStoredLevel()
    Alert.alert('Listo', 'Se borró la clave de nivel. La próxima visita se tratará como primera.')
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lab de insignias</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card variant="outlined" padding={16}>
          <Text style={styles.sectionTitle}>Personalización</Text>
          <Input
            label="Nombre (solo primer nombre)"
            value={previewName}
            onChangeText={setPreviewName}
            placeholder="María"
            autoCapitalize="words"
          />
          <Text style={styles.fieldLabel}>Fecha en la tarjeta</Text>
          <View style={styles.chipRow}>
            <Chip label="Hoy" active={false} onPress={() => setEarnedAt(PREVIEW_EARNED_DATES.today())} />
            <Chip label="Ayer" active={false} onPress={() => setEarnedAt(PREVIEW_EARNED_DATES.yesterday())} />
            <Chip label="Hace 1 sem." active={false} onPress={() => setEarnedAt(PREVIEW_EARNED_DATES.lastWeek())} />
          </View>
          <Text style={styles.datePreview}>{formatEarnedDate(earnedAt)}</Text>
        </Card>

        <Card variant="outlined" padding={16}>
          <Text style={styles.sectionTitle}>Modal de celebración</Text>
          <Text style={styles.hint}>
            Abre la tarjeta completa con confeti para cualquier nivel, sin ganar puntos.
          </Text>
          <View style={styles.levelGrid}>
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((level) => {
              const meta = getLevelMeta(level)
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelTile, { borderColor: meta.accent }]}
                  onPress={() => openModal(level)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.levelTileNum, { color: meta.accent }]}>{level}</Text>
                  <Text style={styles.levelTileName} numberOfLines={1}>{meta.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>

        <Card variant="outlined" padding={16}>
          <Text style={styles.sectionTitle}>Galería de insignias</Text>
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((level) => {
            const meta = LEVEL_META[level]
            return (
              <View key={level} style={styles.galleryRow}>
                <LevelBadgeDisplay level={level} imageSize={64} showName />
                <View style={styles.galleryInfo}>
                  <Text style={styles.galleryPhrase} numberOfLines={2}>{meta.phrase}</Text>
                  <View style={styles.swatchRow}>
                    <Swatch color={meta.accent} label="acento" />
                    <Swatch color={meta.faceColor} label="fondo" />
                  </View>
                </View>
              </View>
            )
          })}
        </Card>

        <Card variant="outlined" padding={16}>
          <Text style={styles.sectionTitle}>AsyncStorage (flujo real)</Text>
          <Text style={styles.hint}>
            Último nivel visto guardado:{' '}
            <Text style={styles.mono}>{storedLevel ?? '(vacío)'}</Text>
          </Text>
          <Text style={styles.hint}>
            Fija el nivel visto en N−1 y luego sube de nivel en la app para disparar el watcher real.
          </Text>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <Chip
                key={n}
                label={`Visto=${n}`}
                active={storedLevel === String(n)}
                onPress={() => setLastSeenLevel(n)}
              />
            ))}
          </View>
          <View style={styles.toolActions}>
            <Button label="Borrar clave" variant="secondary" onPress={clearLastSeenLevel} />
            <Button label="Refrescar" variant="ghost" onPress={refreshStoredLevel} />
          </View>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {preview && (
        <LevelUpModal
          level={preview.level}
          firstName={previewName.trim() || null}
          earnedAt={preview.earnedAt}
          visible
          onClose={() => setPreview(null)}
        />
      )}
    </ScreenWrapper>
  )
}

function Chip({
  label,
  active,
  onPress,
}: {
  label:   string
  active?: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchDot, { backgroundColor: color }]} />
      <Text style={styles.swatchLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   Colors.light.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  back:  { fontSize: 28, color: Colors.light.textPrimary, width: 40, lineHeight: 32 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },
  scroll: { padding: 16, gap: 14 },
  sectionTitle: {
    fontSize:     16,
    fontWeight:   '800',
    color:        Colors.light.textPrimary,
    marginBottom: 10,
  },
  hint: {
    fontSize:     13,
    color:        Colors.light.textSecondary,
    lineHeight:   19,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize:     13,
    fontWeight:   '600',
    color:        Colors.light.textSecondary,
    marginTop:    12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      20,
    backgroundColor:   Colors.light.surface,
    borderWidth:       1,
    borderColor:       Colors.light.border,
  },
  chipActive: {
    backgroundColor: Colors.brand.primary,
    borderColor:     Colors.brand.primary,
  },
  chipText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  chipTextActive: {
    color: '#fff',
  },
  datePreview: {
    marginTop:  10,
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.brand.primary,
    textTransform: 'capitalize',
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  levelTile: {
    width:           '30%',
    minWidth:        96,
    flexGrow:        1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius:    14,
    borderWidth:     2,
    alignItems:      'center',
    backgroundColor: Colors.light.surface,
  },
  levelTileNum: {
    fontSize:   22,
    fontWeight: '900',
  },
  levelTileName: {
    fontSize:   11,
    fontWeight: '600',
    color:      Colors.light.textSecondary,
    marginTop:  2,
  },
  galleryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  galleryInfo: { flex: 1, gap: 6 },
  galleryPhrase: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
    lineHeight: 18,
  },
  swatchRow: { flexDirection: 'row', gap: 12 },
  swatch: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatchDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: Colors.light.border },
  swatchLabel: { fontSize: 11, color: Colors.light.textMuted },
  mono: { fontFamily: 'Menlo', fontWeight: '700' },
  toolActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
})
