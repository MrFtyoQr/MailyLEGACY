/**
 * (doctor)/patients/[id].tsx
 * Detalle de paciente: vitales recientes + medicamentos + citas.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { EmptyState } from '@components/ui/EmptyState'
import { Colors } from '@constants/colors'
import { usePatient, usePatientVitals, usePatientMedications } from '@hooks/usePatients'

type Tab = 'vitals' | 'medications'

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('vitals')

  const { data: patient,      isLoading: loadingPatient } = usePatient(id)
  const { data: latestVitals, isLoading: loadingVitals  } = usePatientVitals(id)
  const { data: meds,         isLoading: loadingMeds    } = usePatientMedications(id)

  const fullName = patient
    ? `${patient.first_name} ${patient.last_name}`
    : '…'

  return (
    <ScreenWrapper edges={['top', 'left', 'right']}>
      {/* Back header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹ Pacientes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Perfil */}
        {loadingPatient ? (
          <ActivityIndicator color={Colors.brand.primary} style={{ marginVertical: 20 }} />
        ) : patient ? (
          <View style={styles.profileSection}>
            <Avatar
              uri={patient.photo_url}
              name={fullName}
              size={72}
              bgColor={Colors.role.doctor}
            />
            <Text style={styles.patientName}>{fullName}</Text>
            <Text style={styles.patientEmail}>{patient.email}</Text>
            {patient.birth_date && (
              <Text style={styles.patientBirth}>
                Nac. {new Date(patient.birth_date).toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </Text>
            )}
          </View>
        ) : null}

        {/* Internal tabs */}
        <View style={styles.tabs}>
          {(['vitals', 'medications'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab === 'vitals' ? '❤️ Vitales' : '💊 Medicamentos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'vitals' ? (
          loadingVitals ? (
            <ActivityIndicator color={Colors.brand.primary} style={{ marginTop: 20 }} />
          ) : latestVitals && typeof latestVitals === 'object' && !Array.isArray(latestVitals) ? (
            <Card>
              <Text style={styles.tabSectionTitle}>Último registro de vitales</Text>
              <View style={styles.vitalsGrid}>
                {(latestVitals as { heart_rate?: number | null; glucose_mgdl?: number | null; systolic_bp?: number | null; diastolic_bp?: number | null; weight_kg?: number | null; severity?: string | null }).heart_rate != null && (
                  <VitalChip icon="❤️" label="FC" value={`${(latestVitals as any).heart_rate}`} unit="lpm" />
                )}
                {(latestVitals as any).glucose_mgdl != null && (
                  <VitalChip icon="🩸" label="Glucosa" value={`${(latestVitals as any).glucose_mgdl}`} unit="mg/dL" />
                )}
                {(latestVitals as any).systolic_bp != null && (
                  <VitalChip
                    icon="💉"
                    label="PA"
                    value={`${(latestVitals as any).systolic_bp}/${(latestVitals as any).diastolic_bp}`}
                    unit="mmHg"
                  />
                )}
                {(latestVitals as any).weight_kg != null && (
                  <VitalChip icon="⚖️" label="Peso" value={`${(latestVitals as any).weight_kg}`} unit="kg" />
                )}
              </View>
              {(latestVitals as any).severity && (
                <View style={{ marginTop: 10 }}>
                  <Badge
                    label={(latestVitals as any).severity === 'critical' ? 'Crítico' : (latestVitals as any).severity === 'warning' ? 'Alerta' : 'Normal'}
                    variant={(latestVitals as any).severity === 'critical' ? 'error' : (latestVitals as any).severity === 'warning' ? 'warning' : 'success'}
                    size="sm"
                  />
                </View>
              )}
            </Card>
          ) : (
            <EmptyState icon="📊" title="Sin vitales" subtitle="Este paciente no tiene registros de signos vitales." />
          )
        ) : (
          loadingMeds ? (
            <ActivityIndicator color={Colors.brand.primary} style={{ marginTop: 20 }} />
          ) : Array.isArray(meds) && meds.length > 0 ? (
            <View style={styles.medList}>
              {(meds as Array<{ id: string; name: string; dose: string; frequency: string; is_active: boolean }>).map((m) => (
                <Card key={m.id} style={styles.medCard}>
                  <View style={styles.medRow}>
                    <View style={styles.medInfo}>
                      <Text style={styles.medName}>{m.name}</Text>
                      <Text style={styles.medDose}>{m.dose} · {m.frequency}</Text>
                    </View>
                    <View style={[styles.activeDot, { backgroundColor: m.is_active ? Colors.semantic.success : Colors.light.textMuted }]} />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState icon="💊" title="Sin medicamentos" subtitle="Este paciente no tiene medicamentos asignados." />
          )
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

function VitalChip({ icon, label, value, unit }: { icon: string; label: string; value: string; unit: string }) {
  return (
    <View style={vc.chip}>
      <Text style={vc.icon}>{icon}</Text>
      <Text style={vc.label}>{label}</Text>
      <Text style={vc.value}>{value}</Text>
      <Text style={vc.unit}>{unit}</Text>
    </View>
  )
}

const vc = StyleSheet.create({
  chip:  { alignItems: 'center', flex: 1, gap: 2 },
  icon:  { fontSize: 20 },
  label: { fontSize: 11, color: Colors.light.textMuted },
  value: { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  unit:  { fontSize: 10, color: Colors.light.textMuted },
})

const styles = StyleSheet.create({
  header: {
    paddingVertical: 12,
  },
  back: {
    fontSize:   17,
    color:      Colors.brand.primary,
    fontWeight: '600',
  },
  content: {
    gap:           16,
    paddingBottom: 24,
  },
  profileSection: {
    alignItems:        'center',
    paddingVertical:   16,
    backgroundColor:   Colors.light.surface,
    borderRadius:      16,
    gap:               6,
  },
  patientName:  { fontSize: 20, fontWeight: '700', color: Colors.light.textPrimary },
  patientEmail: { fontSize: 14, color: Colors.light.textSecondary },
  patientBirth: { fontSize: 13, color: Colors.light.textMuted },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    borderRadius:    10,
    padding:         4,
    gap:             4,
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
  tabLabel:      { fontSize: 13, fontWeight: '600', color: Colors.light.textMuted },
  tabLabelActive: { color: Colors.light.textPrimary },
  tabSectionTitle: { fontSize: 13, fontWeight: '600', color: Colors.light.textMuted, marginBottom: 12 },
  vitalsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  medList:    { gap: 8 },
  medCard:    { padding: 12 },
  medRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  medInfo:    { flex: 1 },
  medName:    { fontSize: 15, fontWeight: '600', color: Colors.light.textPrimary },
  medDose:    { fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  activeDot:  { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
})
