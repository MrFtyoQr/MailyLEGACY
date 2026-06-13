/**
 * (specialist)/referrals/index.tsx
 * Lista completa de referidos entrantes con acciones de estado.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { EmptyState } from '@components/ui/EmptyState'
import { Colors } from '@constants/colors'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

interface Referral {
  id:         string
  patient:    { first_name: string; last_name: string; photo_url: string | null }
  diagnosis:  string | null
  urgency:    'low' | 'medium' | 'high' | 'critical'
  status:     'pending' | 'in_progress' | 'completed' | 'rejected'
  notes:      string | null
  created_at: string
}

interface Section {
  title: string
  data:  Referral[]
}

const URGENCY_BADGE: Record<Referral['urgency'], { label: string; variant: 'neutral' | 'info' | 'warning' | 'error' }> = {
  low:      { label: 'Baja',     variant: 'neutral' },
  medium:   { label: 'Media',    variant: 'info'    },
  high:     { label: 'Alta',     variant: 'warning' },
  critical: { label: 'Crítica',  variant: 'error'   },
}

const STATUS_LABEL: Record<Referral['status'], string> = {
  pending:     'Pendiente',
  in_progress: 'En progreso',
  completed:   'Completado',
  rejected:    'Rechazado',
}

export default function ReferralsScreen() {
  const qc = useQueryClient()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const { data: referrals, isLoading, isError, refetch } = useQuery<Referral[]>({
    queryKey:  ['referrals', 'incoming'],
    staleTime: 2 * 60 * 1000,
    queryFn:   () => get<Referral[]>(EP.referralsIncoming),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      post(EP.referralStatus(id), { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] })
    },
  })

  function handleChangeStatus(referral: Referral) {
    const options: { text: string; onPress: () => void }[] = []

    if (referral.status === 'pending') {
      options.push({
        text: 'Iniciar atención',
        onPress: () => changeStatus(referral.id, 'in_progress'),
      })
    }
    if (referral.status === 'in_progress') {
      options.push({
        text: 'Marcar completado',
        onPress: () => changeStatus(referral.id, 'completed'),
      })
    }
    if (referral.status !== 'rejected' && referral.status !== 'completed') {
      options.push({
        text: 'Rechazar',
        onPress: () => changeStatus(referral.id, 'rejected'),
      })
    }

    if (!options.length) return

    Alert.alert(
      'Actualizar estado',
      `Paciente: ${referral.patient.first_name} ${referral.patient.last_name}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        ...options.map((o) => ({ text: o.text, onPress: o.onPress })),
      ],
    )
  }

  async function changeStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      await updateStatus.mutateAsync({ id, status })
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (isLoading) {
    return (
      <ScreenWrapper>
        <Header />
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.brand.primary} /></View>
      </ScreenWrapper>
    )
  }

  if (isError) {
    return (
      <ScreenWrapper>
        <Header />
        <View style={styles.center}>
          <Text style={styles.errorText}>Error al cargar referidos</Text>
          <Text style={styles.retry} onPress={() => refetch()}>Reintentar</Text>
        </View>
      </ScreenWrapper>
    )
  }

  // Group by status
  const pending    = (referrals ?? []).filter((r) => r.status === 'pending')
  const inProgress = (referrals ?? []).filter((r) => r.status === 'in_progress')
  const done       = (referrals ?? []).filter((r) => r.status === 'completed' || r.status === 'rejected')

  const sections: Section[] = []
  if (pending.length)    sections.push({ title: 'Pendientes',    data: pending    })
  if (inProgress.length) sections.push({ title: 'En progreso',   data: inProgress })
  if (done.length)       sections.push({ title: 'Completados',   data: done       })

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      <Header />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const { label: urgLabel, variant } = URGENCY_BADGE[item.urgency]
          const patientName = `${item.patient.first_name} ${item.patient.last_name}`
          const isUpdating  = updatingId === item.id

          return (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => handleChangeStatus(item)}
              style={styles.itemWrapper}
            >
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Avatar
                    uri={item.patient.photo_url}
                    name={patientName}
                    size={44}
                    bgColor={Colors.role.specialist}
                  />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{patientName}</Text>
                    {item.diagnosis && (
                      <Text style={styles.cardDiag} numberOfLines={2}>{item.diagnosis}</Text>
                    )}
                    <Text style={styles.cardStatus}>{STATUS_LABEL[item.status]}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Badge label={urgLabel} variant={variant} size="sm" />
                    {isUpdating && (
                      <ActivityIndicator size="small" color={Colors.brand.primary} style={{ marginTop: 4 }} />
                    )}
                  </View>
                </View>

                {item.notes && (
                  <Text style={styles.cardNotes} numberOfLines={2}>{item.notes}</Text>
                )}

                <Text style={styles.cardDate}>
                  {new Date(item.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </Text>
              </Card>
            </TouchableOpacity>
          )
        }}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard"
            title="Sin referidos"
            subtitle="No tienes referidos entrantes en este momento."
          />
        }
      />
    </ScreenWrapper>
  )
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Referidos</Text>
    </View>
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
    paddingHorizontal: 20,
    paddingBottom:     8,
    paddingTop:        16,
  },
  list:        { paddingBottom: 100 },
  itemWrapper: { paddingHorizontal: 20, marginBottom: 10 },
  card:        { gap: 6 },
  cardHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  cardInfo:   { flex: 1, gap: 2 },
  cardName:   { fontSize: 15, fontWeight: '600', color: Colors.light.textPrimary },
  cardDiag:   { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },
  cardStatus: { fontSize: 12, color: Colors.light.textMuted, marginTop: 2 },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  cardNotes: {
    fontSize:        13,
    color:           Colors.light.textSecondary,
    fontStyle:       'italic',
    backgroundColor: Colors.light.surface,
    borderRadius:    8,
    padding:         8,
    lineHeight:      18,
  },
  cardDate: {
    fontSize:  11,
    color:     Colors.light.textMuted,
    textAlign: 'right',
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
