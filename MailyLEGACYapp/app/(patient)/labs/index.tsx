/**
 * (patient)/labs/index.tsx
 * Resultados de laboratorio: resumen por parámetro, valores anormales destacados.
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
interface LabResult {
  id:           string
  panel_name:   string
  test_name:    string
  value:        number | string
  unit:         string
  reference_min: number | null
  reference_max: number | null
  is_abnormal:  boolean
  collected_at: string
  notes:        string | null
}

interface LabSummary {
  parameter:    string
  last_value:   number | string
  unit:         string
  is_abnormal:  boolean
  collected_at: string
}

interface AbnormalItem {
  id:          string
  test_name:   string
  value:       number | string
  unit:        string
  collected_at: string
}

type TabKey = 'summary' | 'abnormal' | 'all'

export default function LabsScreen() {
  const [tab, setTab]           = useState<TabKey>('summary')
  const [refreshing, setRefreshing] = useState(false)

  const summaryQ = useQuery<LabSummary[]>({
    queryKey:  ['labs-summary'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<LabSummary[]>(EP.labsSummary),
  })

  const abnormalQ = useQuery<AbnormalItem[]>({
    queryKey:  ['labs-abnormal'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<AbnormalItem[]>(EP.labsAbnormal),
  })

  const allQ = useQuery<{ results: LabResult[] }>({
    queryKey:  ['labs-all'],
    staleTime: 5 * 60 * 1000,
    enabled:   tab === 'all',
    queryFn:   () => get<{ results: LabResult[] }>(EP.labs),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      summaryQ.refetch(),
      abnormalQ.refetch(),
      tab === 'all' ? allQ.refetch() : Promise.resolve(),
    ])
    setRefreshing(false)
  }

  const isLoading = (tab === 'summary' && summaryQ.isLoading)
    || (tab === 'abnormal' && abnormalQ.isLoading)
    || (tab === 'all' && allQ.isLoading)

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔬 Laboratorio</Text>
        {(abnormalQ.data?.length ?? 0) > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{abnormalQ.data!.length} alertas</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['summary', 'abnormal', 'all'] as TabKey[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'summary' ? 'Resumen' : t === 'abnormal' ? 'Alertas' : 'Todos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading && (
          <>
            <Skeleton height={80} borderRadius={16} style={{ marginBottom: 12 }} />
            <Skeleton height={80} borderRadius={16} style={{ marginBottom: 12 }} />
            <Skeleton height={80} borderRadius={16} />
          </>
        )}

        {/* Resumen */}
        {tab === 'summary' && !summaryQ.isLoading && (
          summaryQ.data?.length ? (
            summaryQ.data.map((item) => (
              <Card key={item.parameter} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.paramName}>{item.parameter}</Text>
                    <Text style={styles.paramDate}>
                      {new Date(item.collected_at).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[
                      styles.paramValue,
                      item.is_abnormal && styles.paramValueAbnormal,
                    ]}>
                      {item.last_value} {item.unit}
                    </Text>
                    {item.is_abnormal && (
                      <Badge label="Fuera de rango" variant="error" size="sm" />
                    )}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              emoji="🔬"
              title="Sin resultados disponibles"
              subtitle="Tus resultados de laboratorio aparecerán aquí"
            />
          )
        )}

        {/* Alertas */}
        {tab === 'abnormal' && !abnormalQ.isLoading && (
          abnormalQ.data?.length ? (
            <>
              <View style={styles.alertBanner}>
                <Text style={styles.alertBannerText}>
                  ⚠️  {abnormalQ.data.length} resultado{abnormalQ.data.length > 1 ? 's' : ''} fuera del rango normal. Consulta con tu médico.
                </Text>
              </View>
              {abnormalQ.data.map((item) => (
                <Card key={item.id} style={[styles.card, styles.cardAbnormal]}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.paramName}>{item.test_name}</Text>
                      <Text style={styles.paramDate}>
                        {new Date(item.collected_at).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.paramValue, styles.paramValueAbnormal]}>
                      {item.value} {item.unit}
                    </Text>
                  </View>
                </Card>
              ))}
            </>
          ) : (
            <EmptyState
              emoji="✅"
              title="Todo en orden"
              subtitle="No tienes resultados fuera de rango"
            />
          )
        )}

        {/* Todos */}
        {tab === 'all' && !allQ.isLoading && (
          allQ.data?.results?.length ? (
            allQ.data.results.map((item) => (
              <Card key={item.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.paramName}>{item.test_name}</Text>
                    <Text style={styles.panelName}>{item.panel_name}</Text>
                    <Text style={styles.paramDate}>
                      {new Date(item.collected_at).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[
                      styles.paramValue,
                      item.is_abnormal && styles.paramValueAbnormal,
                    ]}>
                      {item.value} {item.unit}
                    </Text>
                    {item.reference_min != null && item.reference_max != null && (
                      <Text style={styles.refRange}>
                        Ref: {item.reference_min}–{item.reference_max}
                      </Text>
                    )}
                    {item.is_abnormal && (
                      <Badge label="Anormal" variant="error" size="sm" />
                    )}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              emoji="🔬"
              title="Sin resultados disponibles"
              subtitle="Tus resultados de laboratorio aparecerán aquí"
            />
          )
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <View style={es.wrap}>
      <Text style={es.emoji}>{emoji}</Text>
      <Text style={es.title}>{title}</Text>
      <Text style={es.subtitle}>{subtitle}</Text>
    </View>
  )
}

const es = StyleSheet.create({
  wrap:     { alignItems: 'center', marginTop: 60, gap: 10 },
  emoji:    { fontSize: 48 },
  title:    { fontSize: 17, fontWeight: '700', color: Colors.light.textPrimary },
  subtitle: { fontSize: 14, color: Colors.light.textMuted, textAlign: 'center', lineHeight: 20 },
})

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.textPrimary },
  alertBadge: {
    backgroundColor: Colors.semantic.errorBg,
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:  4,
  },
  alertBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.semantic.error },

  tabs: {
    flexDirection:     'row',
    marginHorizontal:  20,
    marginBottom:      16,
    backgroundColor:   Colors.light.surface,
    borderRadius:      12,
    padding:           4,
  },
  tab: {
    flex:            1,
    paddingVertical: 8,
    alignItems:      'center',
    borderRadius:    10,
  },
  tabActive: {
    backgroundColor: Colors.brand.primary,
  },
  tabText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.light.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },

  card: { marginBottom: 12 },
  cardAbnormal: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.semantic.error,
  },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:  { flex: 1, gap: 3 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  paramName: { fontSize: 15, fontWeight: '700', color: Colors.light.textPrimary },
  panelName: { fontSize: 12, color: Colors.light.textMuted },
  paramDate: { fontSize: 12, color: Colors.light.textMuted },
  paramValue: { fontSize: 17, fontWeight: '700', color: Colors.light.textPrimary },
  paramValueAbnormal: { color: Colors.semantic.error },
  refRange:  { fontSize: 11, color: Colors.light.textMuted },

  alertBanner: {
    backgroundColor: Colors.semantic.errorBg,
    borderRadius:    12,
    padding:         14,
    marginBottom:    14,
  },
  alertBannerText: {
    fontSize:   13,
    color:      Colors.semantic.error,
    fontWeight: '600',
    lineHeight: 19,
  },
})
