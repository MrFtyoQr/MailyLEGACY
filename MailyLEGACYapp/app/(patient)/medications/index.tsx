/**
 * (patient)/medications/index.tsx
 * Medicamentos: tab "Hoy" y tab "Todos".
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { EmptyState } from '@components/ui/EmptyState'
import { MedItem } from '@components/medications/MedItem'
import { Card } from '@components/ui/Card'
import { Colors } from '@constants/colors'
import {
  useMedicationsToday,
  useMedications,
  useTakeMedication,
  useSkipMedication,
} from '@hooks/useMedications'

type Tab = 'today' | 'all'

export default function MedicationsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const { data: todayMeds, isLoading: loadingToday } = useMedicationsToday()
  const { data: allMeds,   isLoading: loadingAll   } = useMedications()
  const takeMed = useTakeMedication()
  const skipMed = useSkipMedication()

  async function handleTake(historyId: string) {
    setLoadingId(historyId)
    try { await takeMed.mutateAsync(historyId) } finally { setLoadingId(null) }
  }

  async function handleSkip(historyId: string) {
    setLoadingId(historyId)
    try { await skipMed.mutateAsync(historyId) } finally { setLoadingId(null) }
  }

  // Adherencia del día
  const total   = todayMeds?.length ?? 0
  const taken   = todayMeds?.filter((m) => m.status === 'taken').length ?? 0
  const pct     = total > 0 ? Math.round((taken / total) * 100) : 0
  const pctColor = pct >= 80 ? Colors.semantic.success : pct >= 50 ? Colors.semantic.warning : Colors.semantic.error

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Medicamentos</Text>
      </View>

      {/* Adherencia */}
      {total > 0 && (
        <Card style={styles.adherenceCard}>
          <View style={styles.adherenceRow}>
            <View>
              <Text style={styles.adherenceLabel}>Adherencia hoy</Text>
              <Text style={[styles.adherencePct, { color: pctColor }]}>{pct}%</Text>
            </View>
            <Text style={styles.adherenceCount}>{taken}/{total} tomados</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: pctColor }]} />
          </View>
        </Card>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['today', 'all'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'today' ? 'Hoy' : 'Todos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'today' ? (
        loadingToday ? (
          <View style={styles.center}><ActivityIndicator color={Colors.brand.primary} /></View>
        ) : (
          <FlatList
            data={todayMeds ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MedItem
                entry={item}
                onTake={handleTake}
                onSkip={handleSkip}
                loading={loadingId === item.id}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="pill"
                title="Sin medicamentos hoy"
                subtitle="No tienes medicamentos programados para hoy."
              />
            }
          />
        )
      ) : (
        loadingAll ? (
          <View style={styles.center}><ActivityIndicator color={Colors.brand.primary} /></View>
        ) : (
          <FlatList
            data={allMeds ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/(patient)/medications/[id]', params: { id: item.id } })
                }
                activeOpacity={0.75}
              >
                <Card style={styles.allMedCard}>
                  <View style={styles.allMedRow}>
                    <View style={styles.allMedInfo}>
                      <Text style={styles.allMedName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.allMedDose}>{item.dose} · {item.frequency}</Text>
                      {item.instructions && (
                        <Text style={styles.allMedInstructions} numberOfLines={1}>
                          {item.instructions}
                        </Text>
                      )}
                    </View>
                    <View style={[
                      styles.activeDot,
                      { backgroundColor: item.is_active ? Colors.semantic.success : Colors.light.textMuted }
                    ]} />
                  </View>
                </Card>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="pill"
                title="Sin medicamentos"
                subtitle="Tu médico aún no ha asignado medicamentos."
              />
            }
          />
        )
      )}
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
  adherenceCard: {
    marginHorizontal: 20,
    marginBottom:     12,
  },
  adherenceRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    marginBottom:   10,
  },
  adherenceLabel: {
    fontSize: 12,
    color:    Colors.light.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adherencePct: {
    fontSize:   28,
    fontWeight: '700',
    lineHeight: 32,
  },
  adherenceCount: {
    fontSize: 14,
    color:    Colors.light.textSecondary,
    fontWeight: '500',
  },
  track: {
    height:          8,
    backgroundColor: Colors.light.surface,
    borderRadius:    4,
    overflow:        'hidden',
  },
  fill: {
    height:       8,
    borderRadius: 4,
  },
  tabs: {
    flexDirection:     'row',
    marginHorizontal:  20,
    marginBottom:      12,
    backgroundColor:   Colors.light.surface,
    borderRadius:      10,
    padding:           4,
  },
  tab: {
    flex:            1,
    paddingVertical: 8,
    alignItems:      'center',
    borderRadius:    8,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    4,
    elevation:       2,
  },
  tabLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.light.textMuted,
  },
  tabLabelActive: {
    color: Colors.light.textPrimary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom:     100,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  allMedCard: {
    marginBottom: 8,
    padding:      14,
  },
  allMedRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  allMedInfo: {
    flex: 1,
    gap:  3,
  },
  allMedName: {
    fontSize:   15,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  allMedDose: {
    fontSize: 13,
    color:    Colors.light.textSecondary,
  },
  allMedInstructions: {
    fontSize: 12,
    color:    Colors.light.textMuted,
    fontStyle: 'italic',
  },
  activeDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    marginLeft:   8,
  },
})
