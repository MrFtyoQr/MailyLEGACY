/**
 * VitalCard.tsx
 * Muestra un registro de signos vitales con badge de severidad.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Colors } from '@constants/colors'
import type { VitalEntry } from '@hooks/useVitals'

interface VitalCardProps {
  entry: VitalEntry
}

const SEVERITY_MAP: Record<NonNullable<VitalEntry['severity']>, 'success' | 'warning' | 'error'> = {
  normal:   'success',
  warning:  'warning',
  critical: 'error',
}

const SEVERITY_LABEL: Record<NonNullable<VitalEntry['severity']>, string> = {
  normal:   'Normal',
  warning:  'Alerta',
  critical: 'Crítico',
}

export function VitalCard({ entry }: VitalCardProps) {
  const date = new Date(entry.recorded_at)
  const dateStr = date.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>{dateStr} · {timeStr}</Text>
        {entry.severity && (
          <Badge
            label={SEVERITY_LABEL[entry.severity]}
            variant={SEVERITY_MAP[entry.severity]}
            size="sm"
          />
        )}
      </View>

      <View style={styles.grid}>
        {entry.glucose_mgdl != null && (
          <VitalItem icon="🩸" label="Glucosa" value={`${entry.glucose_mgdl}`} unit="mg/dL" />
        )}
        {entry.heart_rate != null && (
          <VitalItem icon="❤️" label="Frec. cardíaca" value={`${entry.heart_rate}`} unit="lpm" />
        )}
        {entry.systolic_bp != null && entry.diastolic_bp != null && (
          <VitalItem
            icon="💉"
            label="Presión"
            value={`${entry.systolic_bp}/${entry.diastolic_bp}`}
            unit="mmHg"
          />
        )}
        {entry.weight_kg != null && (
          <VitalItem icon="⚖️" label="Peso" value={`${entry.weight_kg}`} unit="kg" />
        )}
      </View>

      {entry.notes ? (
        <Text style={styles.notes} numberOfLines={2}>{entry.notes}</Text>
      ) : null}
    </Card>
  )
}

function VitalItem({
  icon, label, value, unit,
}: { icon: string; label: string; value: string; unit: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemIcon}>{icon}</Text>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>
        {value} <Text style={styles.itemUnit}>{unit}</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   12,
  },
  date: {
    fontSize:  13,
    color:     Colors.light.textSecondary,
    fontWeight: '500',
  },
  grid: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  itemIcon: {
    fontSize: 16,
    width:    24,
  },
  itemLabel: {
    flex:      1,
    fontSize:  14,
    color:     Colors.light.textSecondary,
  },
  itemValue: {
    fontSize:   15,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  itemUnit: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.light.textMuted,
  },
  notes: {
    marginTop:  10,
    fontSize:   13,
    color:      Colors.light.textMuted,
    fontStyle:  'italic',
    lineHeight: 18,
  },
})
