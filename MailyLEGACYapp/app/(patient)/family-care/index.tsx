/**
 * (patient)/family-care/index.tsx
 * Gestión de vínculos familiares del paciente.
 * El paciente puede ver, aceptar y revocar vínculos con cuidadores.
 */

import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors }        from '@constants/colors'
import {
  useFamilyLinks, useAcceptLink, useRevokeLink,
  type FamilyLink,
} from '@hooks/useFamilyCare'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  PARENT:   'Padre / Madre',
  CHILD:    'Hijo / Hija',
  SPOUSE:   'Cónyuge',
  SIBLING:  'Hermano / Hermana',
  CAREGIVER: 'Cuidador',
  OTHER:    'Otro',
}

function LinkCard({
  link,
  onAccept,
  onRevoke,
}: {
  link:     FamilyLink
  onAccept?: () => void
  onRevoke?: () => void
}) {
  const rel = RELATIONSHIP_LABEL[link.relationship] ?? link.relationship

  return (
    <View style={styles.card}>
      <View style={styles.cardAvatar}>
        <Text style={{ fontSize: 24 }}>👤</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{link.caregiver_name}</Text>
        <Text style={styles.cardRel}>{rel}</Text>
        {link.status === 'ACTIVE' && link.accepted_at && (
          <Text style={styles.cardDate}>Vinculado {fmtDate(link.accepted_at)}</Text>
        )}
        {link.status === 'PENDING' && (
          <Text style={[styles.cardDate, { color: Colors.semantic.warning }]}>
            Solicitud pendiente — {fmtDate(link.created_at)}
          </Text>
        )}
      </View>
      <View style={styles.cardActions}>
        {link.status === 'PENDING' && onAccept && (
          <TouchableOpacity style={styles.btnAccept} onPress={onAccept} activeOpacity={0.7}>
            <Text style={styles.btnAcceptText}>Aceptar</Text>
          </TouchableOpacity>
        )}
        {(link.status === 'ACTIVE' || link.status === 'PENDING') && onRevoke && (
          <TouchableOpacity style={styles.btnRevoke} onPress={onRevoke} activeOpacity={0.7}>
            <Text style={styles.btnRevokeText}>
              {link.status === 'PENDING' ? 'Rechazar' : 'Revocar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export default function FamilyCareScreen() {
  const { data, isLoading, refetch } = useFamilyLinks()
  const accept = useAcceptLink()
  const revoke = useRevokeLink()

  const links    = data?.results ?? []
  const active   = links.filter((l) => l.status === 'ACTIVE')
  const pending  = links.filter((l) => l.status === 'PENDING')

  function handleAccept(id: string, name: string) {
    Alert.alert(
      'Aceptar vínculo',
      `¿Aceptas que ${name} sea tu cuidador?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => accept.mutate(id) },
      ],
    )
  }

  function handleRevoke(id: string, name: string, isPending: boolean) {
    Alert.alert(
      isPending ? 'Rechazar solicitud' : 'Revocar vínculo',
      isPending
        ? `¿Rechazas la solicitud de ${name}?`
        : `¿Revocas el vínculo con ${name}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isPending ? 'Rechazar' : 'Revocar',
          style: 'destructive',
          onPress: () => revoke.mutate(id),
        },
      ],
    )
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cuidadores familiares</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Solicitudes pendientes */}
          {pending.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Solicitudes pendientes</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pending.length}</Text>
                </View>
              </View>
              {pending.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  onAccept={() => handleAccept(link.id, link.caregiver_name)}
                  onRevoke={() => handleRevoke(link.id, link.caregiver_name, true)}
                />
              ))}
            </View>
          )}

          {/* Vínculos activos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vínculos activos</Text>
            {active.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>👨‍👩‍👧</Text>
                <Text style={styles.emptyTitle}>Sin cuidadores vinculados</Text>
                <Text style={styles.emptyText}>
                  Cuando un familiar te envíe una solicitud aparecerá aquí.
                </Text>
              </View>
            ) : (
              active.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  onRevoke={() => handleRevoke(link.id, link.caregiver_name, false)}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </ScreenWrapper>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

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
  back: {
    fontSize: 28,
    color:    Colors.light.textPrimary,
    width:    40,
    lineHeight: 32,
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 16,
    gap:     16,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  sectionTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  badge: {
    backgroundColor: Colors.semantic.warning,
    borderRadius:    10,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  badgeText: {
    fontSize:   12,
    fontWeight: '700',
    color:      '#FFFFFF',
  },

  // Card
  card: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.light.surface,
    borderRadius:     16,
    padding:          14,
    borderWidth:      1,
    borderColor:      Colors.light.border,
    gap:              12,
  },
  cardAvatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: Colors.light.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardInfo: {
    flex: 1,
    gap:  2,
  },
  cardName: {
    fontSize:   15,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  cardRel: {
    fontSize: 13,
    color:    Colors.light.textSecondary,
  },
  cardDate: {
    fontSize: 11,
    color:    Colors.light.textMuted,
  },
  cardActions: {
    gap: 6,
  },
  btnAccept: {
    backgroundColor: Colors.brand.primary,
    borderRadius:    10,
    paddingHorizontal: 12,
    paddingVertical:   7,
  },
  btnAcceptText: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#FFFFFF',
  },
  btnRevoke: {
    borderWidth:  1,
    borderColor:  Colors.semantic.error,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical:   7,
  },
  btnRevokeText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.semantic.error,
  },

  // Empty
  emptyBox: {
    backgroundColor: Colors.light.surface,
    borderRadius:    16,
    padding:         32,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     Colors.light.border,
  },
  emptyTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize:  13,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
  },
})
