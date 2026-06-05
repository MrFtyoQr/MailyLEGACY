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
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card }          from '@components/ui/Card'
import { Badge }         from '@components/ui/Badge'
import { Skeleton }      from '@components/ui/Skeleton'
import { Colors }        from '@constants/colors'
import { get, post }     from '@lib/api/client'
import { EP }            from '@lib/api/endpoints'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface LabPanel {
  id:          string
  panel_name:  string
  lab_name:    string
  performed_at: string
}

interface LabResult {
  id:           string
  panel:        { id: string; panel_name: string } | null
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

// ── Modal de análisis IA ──────────────────────────────────────────────────────
function AIModal({
  visible, onClose, panelId, panelName,
}: {
  visible: boolean; onClose: () => void
  panelId: string;  panelName: string
}) {
  const [analysis,   setAnalysis]   = useState<string | null>(null)
  const [disclaimer, setDisclaimer] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function analyze() {
    setLoading(true); setError(''); setAnalysis(null)
    try {
      const res = await post<{ analysis: string; disclaimer: string }>(EP.aiAnalyze, {
        type: 'lab_panel',
        id:   panelId,
      })
      setAnalysis(res.analysis)
      setDisclaimer(res.disclaimer)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo generar el análisis.')
    } finally {
      setLoading(false)
    }
  }

  // Lanzar análisis automáticamente al abrir
  React.useEffect(() => {
    if (visible && !analysis && !loading) analyze()
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={aiStyles.overlay} onPress={onClose} />
      <View style={aiStyles.sheet}>
        <View style={aiStyles.handle} />
        <View style={aiStyles.header}>
          <Text style={aiStyles.title}>🤖 Análisis IA — {panelName || 'Laboratorio'}</Text>
          <TouchableOpacity onPress={onClose}><Text style={aiStyles.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={aiStyles.body} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={aiStyles.center}>
              <ActivityIndicator color={Colors.brand.primary} size="large" />
              <Text style={aiStyles.loadingText}>Analizando con IA…</Text>
            </View>
          )}
          {error ? (
            <Text style={aiStyles.error}>{error}</Text>
          ) : analysis ? (
            <>
              <Text style={aiStyles.analysis}>{analysis}</Text>
              <View style={aiStyles.disclaimerBox}>
                <Text style={aiStyles.disclaimerText}>{disclaimer}</Text>
              </View>
            </>
          ) : null}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  )
}

export default function LabsScreen() {
  const [tab, setTab]           = useState<TabKey>('summary')
  const [refreshing, setRefreshing] = useState(false)
  const [aiPanel, setAiPanel]   = useState<{ id: string; name: string } | null>(null)

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

      {/* Modal IA */}
      {aiPanel && (
        <AIModal
          visible={!!aiPanel}
          onClose={() => setAiPanel(null)}
          panelId={aiPanel.id}
          panelName={aiPanel.name}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔬 Laboratorio</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {(abnormalQ.data?.length ?? 0) > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{abnormalQ.data!.length} alertas</Text>
            </View>
          )}
          {allQ.data?.results?.[0]?.panel?.id && (
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={() => setAiPanel({
                id:   allQ.data!.results[0].panel!.id,
                name: allQ.data!.results[0].panel!.panel_name,
              })}
              activeOpacity={0.8}
            >
              <Text style={styles.aiBtnText}>🤖 IA</Text>
            </TouchableOpacity>
          )}
        </View>
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
  aiBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius:    16,
    paddingHorizontal: 12,
    paddingVertical:   5,
  },
  aiBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
})

const aiStyles = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.light.border, alignSelf: 'center', marginTop: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  title:    { fontSize: 15, fontWeight: '700', color: Colors.light.textPrimary, flex: 1 },
  close:    { fontSize: 20, color: Colors.light.textMuted, paddingLeft: 12 },
  body:     { paddingHorizontal: 20, paddingTop: 16 },
  center:   { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.light.textMuted },
  error:    { fontSize: 14, color: Colors.semantic.error, textAlign: 'center', marginTop: 20 },
  analysis: { fontSize: 14, color: Colors.light.textPrimary, lineHeight: 22 },
  disclaimerBox: {
    marginTop: 16, backgroundColor: Colors.semantic.warningBg,
    borderRadius: 10, padding: 12,
  },
  disclaimerText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
})
