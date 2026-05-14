/**
 * (doctor)/patients/index.tsx
 * Lista completa de pacientes con búsqueda local.
 */

import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { EmptyState } from '@components/ui/EmptyState'
import { PatientCard } from '@components/patients/PatientCard'
import { Colors } from '@constants/colors'
import { usePatients } from '@hooks/usePatients'

export default function PatientsListScreen() {
  const [query, setQuery] = useState('')
  const { data: patients, isLoading, isError, refetch } = usePatients()

  const filtered = useMemo(() => {
    if (!patients) return []
    if (!query.trim()) return patients
    const q = query.toLowerCase()
    return patients.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    )
  }, [patients, query])

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis Pacientes</Text>
        {patients && (
          <Text style={styles.count}>{patients.length} total</Text>
        )}
      </View>

      {/* Búsqueda */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o email…"
          placeholderTextColor={Colors.light.textMuted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Error al cargar pacientes</Text>
          <Text style={styles.retry} onPress={() => refetch()}>Reintentar</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PatientCard
              patient={item}
              onPress={() =>
                router.push({ pathname: '/(doctor)/patients/[id]', params: { id: item.id } })
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            query ? (
              <EmptyState
                icon="🔍"
                title="Sin resultados"
                subtitle={`No se encontraron pacientes para "${query}".`}
              />
            ) : (
              <EmptyState
                icon="👥"
                title="Sin pacientes"
                subtitle="Aún no tienes pacientes asignados."
              />
            )
          }
        />
      )}
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'baseline',
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  title: {
    fontSize:   22,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  count: {
    fontSize: 14,
    color:    Colors.light.textMuted,
  },
  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  20,
    marginBottom:      12,
    backgroundColor:   Colors.light.surface,
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap:               8,
    borderWidth:       1,
    borderColor:       Colors.light.border,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex:      1,
    fontSize:  15,
    color:     Colors.light.textPrimary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom:     100,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  errorText: { fontSize: 15, color: Colors.semantic.error },
  retry: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '600',
  },
})
