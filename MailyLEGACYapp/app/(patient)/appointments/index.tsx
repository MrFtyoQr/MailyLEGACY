/**
 * (patient)/appointments/index.tsx
 * Lista de citas del paciente: próximas y pasadas.
 */

import React, { useMemo } from 'react'
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { EmptyState } from '@components/ui/EmptyState'
import { AppointmentCard } from '@components/appointments/AppointmentCard'
import { Colors } from '@constants/colors'
import { useAppointments, type Appointment } from '@hooks/useAppointments'

interface Section {
  title: string
  data:  Appointment[]
}

export default function AppointmentsScreen() {
  const { data: appts, isLoading, isError, refetch } = useAppointments()

  const sections = useMemo((): Section[] => {
    if (!appts) return []
    const now = new Date()
    const upcoming = appts
      .filter((a) => new Date(a.scheduled_at) >= now && a.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    const past = appts
      .filter((a) => new Date(a.scheduled_at) < now || a.status === 'CANCELLED')
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

    const result: Section[] = []
    if (upcoming.length) result.push({ title: 'Próximas citas', data: upcoming })
    if (past.length)     result.push({ title: 'Historial',      data: past     })
    return result
  }, [appts])

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}><Text style={styles.title}>Mis Citas</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.brand.primary} /></View>
      </ScreenWrapper>
    )
  }

  if (isError) {
    return (
      <ScreenWrapper>
        <View style={styles.header}><Text style={styles.title}>Mis Citas</Text></View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Error al cargar citas</Text>
          <Text style={styles.retryLink} onPress={() => refetch()}>Reintentar</Text>
        </View>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Citas</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            onPress={() =>
              router.push({ pathname: '/(patient)/appointments/[id]', params: { id: item.id } })
            }
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="Sin citas"
            subtitle="Aún no tienes citas programadas con tu médico."
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
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  errorText: {
    fontSize: 15,
    color:    Colors.semantic.error,
  },
  retryLink: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '600',
  },
})
