/**
 * (patient)/prescriptions/index.tsx
 * Recetas médicas — lista con estado, origen y medicamentos incluidos.
 */

import React, { useState } from 'react'
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card }          from '@components/ui/Card'
import { Badge }         from '@components/ui/Badge'
import { Skeleton }      from '@components/ui/Skeleton'
import { Colors }        from '@constants/colors'
import { get }           from '@lib/api/client'
import { EP }            from '@lib/api/endpoints'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type PrescriptionStatus = 'ACTIVE' | 'EXPIRED' | 'USED' | 'UNKNOWN'
type PrescriptionSource = 'MANUAL' | 'MAILYSOFT'

interface MedicationListed {
  name:       string
  dose?:      string
  frequency?: string
  duration?:  string
}

interface Prescription {
  id:                string
  source:            PrescriptionSource
  status:            PrescriptionStatus
  doctor_name:       string | null
  diagnosis:         string | null
  issued_at:         string | null
  expires_at:        string | null
  medications_listed: MedicationListed[]
  file_url:          string | null
  notes:             string | null
  created_at:        string
}

interface PrescriptionsResponse {
  results: Prescription[]
  count:   number
}

const STATUS_LABEL: Record<PrescriptionStatus, string> = {
  ACTIVE:  'Activa',
  EXPIRED: 'Vencida',
  USED:    'Usada',
  UNKNOWN: 'Desconocida',
}

const STATUS_VARIANT: Record<PrescriptionStatus, 'success' | 'error' | 'neutral' | 'warning'> = {
  ACTIVE:  'success',
  EXPIRED: 'error',
  USED:    'neutral',
  UNKNOWN: 'warning',
}

const SOURCE_LABEL: Record<PrescriptionSource, string> = {
  MANUAL:    '✏️ Manual',
  MAILYSOFT: '⚡ MailySoft',
}

export default function PrescriptionsScreen() {
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useQuery<PrescriptionsResponse>({
    queryKey:  ['prescriptions'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<PrescriptionsResponse>(EP.prescriptions),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const prescriptions = data?.results ?? []
  const active  = prescriptions.filter((p) => p.status === 'ACTIVE')
  const rest    = prescriptions.filter((p) => p.status !== 'ACTIVE')

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Recetas médicas</Text>
        {active.length > 0 && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{active.length} activa{active.length > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading && (
          <>
            <Skeleton height={140} borderRadius={16} style={{ marginBottom: 12 }} />
            <Skeleton height={140} borderRadius={16} style={{ marginBottom: 12 }} />
          </>
        )}

        {!isLoading && prescriptions.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Sin recetas registradas</Text>
            <Text style={styles.emptySubtitle}>
              Tus recetas médicas aparecerán aquí cuando tu médico las registre o las recibas vía MailySoft.
            </Text>
          </View>
        )}

        {/* Activas primero */}
        {active.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Activas</Text>
            {active.map((p) => <PrescriptionCard key={p.id} prescription={p} />)}
          </>
        )}

        {/* Resto */}
        {rest.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Historial</Text>
            {rest.map((p) => <PrescriptionCard key={p.id} prescription={p} />)}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

function PrescriptionCard({ prescription: p }: { prescription: Prescription }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((v) => !v)}
    >
      <Card style={[styles.card, p.status === 'ACTIVE' && styles.cardActive]}>
        {/* Fila superior */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.sourceLabel}>{SOURCE_LABEL[p.source]}</Text>
            {p.issued_at && (
              <Text style={styles.issuedDate}>
                {new Date(p.issued_at).toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </Text>
            )}
          </View>
          <Badge
            label={STATUS_LABEL[p.status]}
            variant={STATUS_VARIANT[p.status]}
            size="sm"
          />
        </View>

        {/* Doctor y diagnóstico */}
        {p.doctor_name && (
          <Text style={styles.doctorName}>👨‍⚕️ {p.doctor_name}</Text>
        )}
        {p.diagnosis && (
          <Text style={styles.diagnosis} numberOfLines={expanded ? undefined : 1}>
            Dx: {p.diagnosis}
          </Text>
        )}

        {/* Medicamentos listados */}
        {p.medications_listed.length > 0 && (
          <View style={styles.medsSection}>
            <Text style={styles.medsSectionTitle}>Medicamentos:</Text>
            {(expanded ? p.medications_listed : p.medications_listed.slice(0, 2)).map((m, i) => (
              <View key={i} style={styles.medItem}>
                <View style={styles.medDot} />
                <Text style={styles.medText} numberOfLines={1}>
                  {m.name}
                  {m.dose ? ` — ${m.dose}` : ''}
                  {m.frequency ? ` · ${m.frequency}` : ''}
                </Text>
              </View>
            ))}
            {!expanded && p.medications_listed.length > 2 && (
              <Text style={styles.moreText}>+{p.medications_listed.length - 2} más…</Text>
            )}
          </View>
        )}

        {/* Vencimiento */}
        {p.expires_at && (
          <Text style={[
            styles.expiryText,
            p.status === 'EXPIRED' && styles.expiryExpired,
          ]}>
            Vence: {new Date(p.expires_at).toLocaleDateString('es-MX', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </Text>
        )}

        {/* Expandir/colapsar */}
        <Text style={styles.expandHint}>{expanded ? '▲ Ver menos' : '▼ Ver detalle'}</Text>
      </Card>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.textPrimary },
  activeBadge: {
    backgroundColor: Colors.semantic.successBg,
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:  4,
  },
  activeBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.semantic.success },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },

  sectionLabel: {
    fontSize:    13,
    fontWeight:  '700',
    color:       Colors.light.textMuted,
    marginBottom: 8,
    marginTop:   12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  card:       { marginBottom: 12, gap: 6 },
  cardActive: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.semantic.success,
  },

  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { gap: 2 },
  sourceLabel:    { fontSize: 12, fontWeight: '600', color: Colors.brand.primary },
  issuedDate:     { fontSize: 12, color: Colors.light.textMuted },

  doctorName: { fontSize: 14, fontWeight: '700', color: Colors.light.textPrimary },
  diagnosis:  { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },

  medsSection:      { marginTop: 4, gap: 4 },
  medsSectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.light.textMuted },
  medItem:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.primary },
  medText:          { fontSize: 13, color: Colors.light.textSecondary, flex: 1 },
  moreText:         { fontSize: 12, color: Colors.brand.primary, fontWeight: '600' },

  expiryText:    { fontSize: 12, color: Colors.light.textMuted },
  expiryExpired: { color: Colors.semantic.error },

  expandHint: { fontSize: 12, color: Colors.brand.primary, fontWeight: '600', marginTop: 4 },

  emptyWrap:     { alignItems: 'center', marginTop: 80, gap: 12, paddingHorizontal: 20 },
  emptyEmoji:    { fontSize: 52 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.light.textMuted, textAlign: 'center', lineHeight: 21 },
})
