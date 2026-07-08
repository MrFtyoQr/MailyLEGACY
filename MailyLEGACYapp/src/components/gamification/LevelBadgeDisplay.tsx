/**
 * Insignia hexagonal de nivel + etiqueta NIVEL X.
 */

import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'
import { getLevelMeta } from '@constants/levelBadges'

interface LevelBadgeDisplayProps {
  level:      number
  imageSize?: number
  /** Texto claro sobre fondos oscuros (hero de puntos) */
  light?:     boolean
  showName?:  boolean
}

export function LevelBadgeDisplay({
  level,
  imageSize = 72,
  light = false,
  showName = false,
}: LevelBadgeDisplayProps) {
  const meta = getLevelMeta(level)

  return (
    <View style={styles.wrap}>
      <Image
        source={meta.image}
        style={{ width: imageSize, height: imageSize }}
        resizeMode="contain"
      />
      <Text style={[styles.levelLabel, light && styles.levelLabelLight]}>
        NIVEL {level}
      </Text>
      {showName && (
        <Text style={[styles.nameLabel, light && styles.nameLabelLight, { color: light ? '#fff' : meta.accent }]}>
          {meta.name.toUpperCase()}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap:        2,
  },
  levelLabel: {
    fontSize:      10,
    fontWeight:    '800',
    color:         Colors.light.textSecondary,
    letterSpacing: 1,
    marginTop:     2,
  },
  levelLabelLight: {
    color: 'rgba(255,255,255,0.9)',
  },
  nameLabel: {
    fontSize:   11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nameLabelLight: {
    opacity: 0.95,
  },
})
