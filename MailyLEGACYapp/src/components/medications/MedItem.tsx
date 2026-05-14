/**
 * MedItem.tsx
 * Fila de medicamento con botones Tomar / Saltar.
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Colors } from '@constants/colors'
import type { MedHistoryEntry } from '@hooks/useMedications'

interface MedItemProps {
  entry:      MedHistoryEntry
  onTake?:    (historyId: string) => void
  onSkip?:    (historyId: string) => void
  loading?:   boolean
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente', color: Colors.semantic.warning, bg: Colors.semantic.warningBg },
  taken:     { label: 'Tomado',    color: Colors.semantic.success, bg: Colors.semantic.successBg },
  skipped:   { label: 'Saltado',   color: Colors.semantic.error,   bg: Colors.semantic.errorBg },
  postponed: { label: 'Pospuesto', color: Colors.light.textMuted,  bg: Colors.light.surface },
}

export function MedItem({ entry, onTake, onSkip, loading }: MedItemProps) {
  const config = STATUS_CONFIG[entry.status]

  const scheduledDate = new Date(entry.scheduled_at)
  const timeStr = scheduledDate.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={[styles.statusDot, { backgroundColor: config.color }]} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.medication.name}
          </Text>
          <Text style={styles.dose}>
            {entry.medication.dose} · {timeStr}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.brand.primary} />
        ) : entry.status === 'pending' ? (
          <View style={styles.actions}>
            {onTake && (
              <TouchableOpacity
                style={[styles.btn, styles.btnTake]}
                onPress={() => onTake(entry.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.btnTakeText}>Tomar</Text>
              </TouchableOpacity>
            )}
            {onSkip && (
              <TouchableOpacity
                style={[styles.btn, styles.btnSkip]}
                onPress={() => onSkip(entry.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.btnSkipText}>Saltar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.card,
    borderRadius:    12,
    marginBottom:    8,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    4,
    elevation:       2,
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
    gap:           12,
  },
  statusDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize:   15,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  dose: {
    fontSize: 13,
    color:    Colors.light.textSecondary,
    marginTop: 2,
  },
  right: {
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap:           6,
  },
  btn: {
    paddingVertical:   6,
    paddingHorizontal: 12,
    borderRadius:      8,
  },
  btnTake: {
    backgroundColor: Colors.brand.primary,
  },
  btnSkip: {
    backgroundColor: Colors.light.surface,
    borderWidth:     1,
    borderColor:     Colors.light.border,
  },
  btnTakeText: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#fff',
  },
  btnSkipText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.light.textSecondary,
  },
  statusBadge: {
    paddingVertical:   4,
    paddingHorizontal: 10,
    borderRadius:      20,
  },
  statusText: {
    fontSize:   12,
    fontWeight: '600',
  },
})
