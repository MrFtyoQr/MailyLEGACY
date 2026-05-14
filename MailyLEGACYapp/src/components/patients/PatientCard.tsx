/**
 * PatientCard.tsx
 * Card de paciente para la vista del médico.
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { Colors } from '@constants/colors'
import type { Patient } from '@hooks/usePatients'

interface PatientCardProps {
  patient:  Patient
  onPress?: () => void
}

function timeAgo(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ayer'
  if (days < 7)   return `hace ${days} d`
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export function PatientCard({ patient, onPress }: PatientCardProps) {
  const fullName = `${patient.first_name} ${patient.last_name}`
  const lastVital = timeAgo(patient.last_vital_at)

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.container}>
      <Avatar
        uri={patient.photo_url}
        name={fullName}
        size={48}
        bgColor={Colors.brand.cool}
      />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
        <Text style={styles.email} numberOfLines={1}>{patient.email}</Text>
      </View>

      <View style={styles.right}>
        {lastVital ? (
          <Badge label={lastVital} variant="neutral" size="sm" />
        ) : (
          <Badge label="Sin datos" variant="neutral" size="sm" />
        )}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    paddingHorizontal: 16,
    backgroundColor:   Colors.light.card,
    borderRadius:      12,
    marginBottom:      8,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.04,
    shadowRadius:      4,
    elevation:         2,
    gap:               12,
  },
  info: {
    flex: 1,
    gap:  2,
  },
  name: {
    fontSize:   15,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  email: {
    fontSize: 13,
    color:    Colors.light.textSecondary,
  },
  right: {
    alignItems: 'center',
    gap:        4,
  },
  chevron: {
    fontSize:   18,
    color:      Colors.light.textMuted,
    lineHeight: 20,
  },
})
