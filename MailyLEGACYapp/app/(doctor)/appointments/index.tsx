/**
 * (doctor)/appointments/index.tsx
 * Agenda del médico: citas por sección con acciones confirmar / completar.
 */

import React from 'react'
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import { Colors } from '@constants/colors'
import {
  useDoctorAppointments,
  useConfirmAppointment,
  useCompleteAppointment,
  type Appointment,
} from '@hooks/useAppointments'

interface Section {
  title: string
  data:  Appointment[]
}

const STATUS_BADGE: Record<Appointment['status'], { label: string; variant: 'info' | 'success' | 'neutral' | 'error' | 'warning' }> = {
  PENDING:   { label: 'Pendiente',  variant: 'warning' },
  CONFIRMED: { label: 'Confirmada', variant: 'info' },
  COMPLETED: { label: 'Completada', variant: 'success' },
  CANCELLED: { label: 'Cancelada',  variant: 'error' },
}

export default function DoctorAppointmentsScreen() {
  const { data: appts, isLoading, isError, refetch } = useDoctorAppointments()
  const confirmAppt  = useConfirmAppointment()
  const completeAppt = useCompleteAppointment()

  function handleConfirm(id: string) {
    Alert.alert('Confirmar cita', '¿Confirmar esta cita con el paciente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try { await confirmAppt.mutateAsync(id) }
          catch { Alert.alert('Error', 'No se pudo confirmar.') }
        },
      },
    ])
  }

  function handleComplete(id: string) {
    Alert.alert('Marcar completada', '¿Marcar esta cita como completada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Completar',
        onPress: async () => {
          try { await completeAppt.mutateAsync(id) }
          catch { Alert.alert('Error', 'No se pudo completar.') }
        },
      },
    ])
  }

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}><Text style={styles.title}>Agenda</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.brand.primary} /></View>
      </ScreenWrapper>
    )
  }

  if (isError) {
    return (
      <ScreenWrapper>
        <View style={styles.header}><Text style={styles.title}>Agenda</Text></View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Error al cargar agenda</Text>
          <Text style={styles.retry} onPress={() => refetch()}>Reintentar</Text>
        </View>
      </ScreenWrapper>
    )
  }

  const now = new Date()
  const upcoming = (appts ?? [])
    .filter((a) => new Date(a.scheduled_at) >= now && a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const past = (appts ?? [])
    .filter((a) => new Date(a.scheduled_at) < now || a.status === 'CANCELLED')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  const sections: Section[] = []
  if (upcoming.length) sections.push({ title: 'Próximas', data: upcoming })
  if (past.length)     sections.push({ title: 'Pasadas',  data: past })

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const { label, variant } = STATUS_BADGE[item.status]
          const scheduled = new Date(item.scheduled_at)
          return (
            <Card style={styles.apptCard}>
              <View style={styles.apptHeader}>
                <View>
                  <Text style={styles.apptTime}>
                    {scheduled.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.apptDate}>
                    {scheduled.toLocaleDateString('es-MX', {
                      weekday: 'short', day: '2-digit', month: 'short',
                    })}
                  </Text>
                </View>
                <Badge label={label} variant={variant} size="sm" />
              </View>
              <Text style={styles.apptDoctor}>{item.doctor_name}</Text>
              <Text style={styles.apptSpec}>{item.specialty}</Text>
              <Text style={styles.apptDuration}>{item.duration_min} min</Text>

              {/* Acciones */}
              <View style={styles.actionsRow}>
                {item.status === 'PENDING' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleConfirm(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionBtnText}>Confirmar</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'CONFIRMED' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.semantic.successBg }]}
                    onPress={() => handleComplete(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionBtnText, { color: Colors.semantic.success }]}>
                      Completar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          )
        }}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="Sin citas"
            subtitle="No tienes citas en tu agenda."
          />
        }
      />
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  title: {
    fontSize:   22,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  sectionHeader: {
    fontSize:          14,
    fontWeight:        '700',
    color:             Colors.light.textSecondary,
    textTransform:     'uppercase',
    letterSpacing:     0.5,
    paddingHorizontal: 20,
    paddingBottom:     8,
    paddingTop:        16,
  },
  list: {
    paddingBottom: 100,
  },
  apptCard: {
    marginHorizontal: 20,
    marginBottom:     10,
    gap:              6,
  },
  apptHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   4,
  },
  apptTime:     { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },
  apptDate:     { fontSize: 13, color: Colors.light.textSecondary, textTransform: 'capitalize' },
  apptDoctor:   { fontSize: 15, fontWeight: '600', color: Colors.light.textPrimary },
  apptSpec:     { fontSize: 13, color: Colors.light.textSecondary },
  apptDuration: { fontSize: 12, color: Colors.light.textMuted },
  actionsRow: {
    flexDirection:  'row',
    gap:            8,
    marginTop:      8,
  },
  actionBtn: {
    backgroundColor:   Colors.brand.primary + '20',
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      8,
  },
  actionBtnText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.brand.primary,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  errorText: { fontSize: 15, color: Colors.semantic.error },
  retry:     { fontSize: 14, color: Colors.brand.primary, fontWeight: '600' },
})
