/**
 * (patient)/settings.tsx
 * ----------------------
 * Configuración del usuario: permisos del dispositivo, soporte y sobre la app.
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Linking, Alert,
} from 'react-native'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import * as Location     from 'expo-location'
import * as ImagePicker  from 'expo-image-picker'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card }          from '@components/ui/Card'
import { IconBadge }     from '@components/ui/IconBadge'
import { MenuRow }       from '@components/ui/MenuRow'
import { AppIcon, type AppIconName } from '@components/ui/AppIcon'
import { Colors }        from '@constants/colors'

type PermStatus = 'granted' | 'denied' | 'undetermined' | 'loading'

function statusLabel(s: PermStatus): string {
  if (s === 'loading')       return 'Verificando…'
  if (s === 'granted')       return 'Activado'
  if (s === 'denied')        return 'Denegado — activa en Ajustes'
  return 'Sin configurar'
}

function statusColor(s: PermStatus): string {
  if (s === 'granted') return Colors.semantic.success
  if (s === 'denied')  return Colors.semantic.error
  return Colors.light.textMuted
}

export default function SettingsScreen() {
  const [notifStatus, setNotifStatus] = useState<PermStatus>('loading')
  const [locStatus,   setLocStatus]   = useState<PermStatus>('loading')
  const [photoStatus, setPhotoStatus] = useState<PermStatus>('loading')

  useEffect(() => {
    checkPermissions()
  }, [])

  async function checkPermissions() {
    const [notif, loc, photo] = await Promise.all([
      Notifications.getPermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
    ])
    setNotifStatus(notif.granted  ? 'granted' : notif.status  === 'undetermined' ? 'undetermined' : 'denied')
    setLocStatus  (loc.granted    ? 'granted' : loc.status    === 'undetermined' ? 'undetermined' : 'denied')
    setPhotoStatus(photo.granted  ? 'granted' : photo.status  === 'undetermined' ? 'undetermined' : 'denied')
  }

  async function requestNotifications() {
    if (notifStatus === 'denied') {
      Alert.alert('Permisos denegados', 'Ve a Ajustes del dispositivo para activar las notificaciones.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a Ajustes', onPress: () => Linking.openSettings() },
      ])
      return
    }
    const { granted } = await Notifications.requestPermissionsAsync()
    setNotifStatus(granted ? 'granted' : 'denied')
  }

  async function requestLocation() {
    if (locStatus === 'denied') {
      Alert.alert('Permisos denegados', 'Ve a Ajustes del dispositivo para activar la ubicación.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a Ajustes', onPress: () => Linking.openSettings() },
      ])
      return
    }
    const { granted } = await Location.requestForegroundPermissionsAsync()
    setLocStatus(granted ? 'granted' : 'denied')
  }

  async function requestPhotos() {
    if (photoStatus === 'denied') {
      Alert.alert('Permisos denegados', 'Ve a Ajustes del dispositivo para activar el acceso a fotos.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a Ajustes', onPress: () => Linking.openSettings() },
      ])
      return
    }
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    setPhotoStatus(granted ? 'granted' : 'denied')
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Permisos del dispositivo ── */}
        <Text style={styles.sectionLabel}>Permisos del dispositivo</Text>
        <Card style={styles.card}>
          <PermRow
            icon="bell"
            label="Notificaciones"
            desc="Recibe recordatorios de medicamentos y alertas de salud"
            status={notifStatus}
            onToggle={requestNotifications}
          />
          <View style={styles.divider} />
          <PermRow
            icon="location"
            label="Ubicación"
            desc="Encuentra clínicas y médicos cercanos a ti"
            status={locStatus}
            onToggle={requestLocation}
          />
          <View style={styles.divider} />
          <PermRow
            icon="image"
            label="Fotos y archivos"
            desc="Sube documentos médicos e imágenes de evidencia"
            status={photoStatus}
            onToggle={requestPhotos}
          />
        </Card>

        {/* ── Soporte ── */}
        <Text style={styles.sectionLabel}>Soporte</Text>
        <Card style={styles.card}>
          <MenuRow
            icon="chat"
            label="Contactar soporte"
            onPress={() => Linking.openURL('mailto:soporte@mailytcuida.com')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="bug"
            label="Reportar un problema"
            onPress={() => Linking.openURL('mailto:soporte@mailytcuida.com?subject=Reporte%20de%20problema')}
          />
        </Card>

        {/* ── Legal ── */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <Card style={styles.card}>
          <MenuRow
            icon="lock-closed"
            label="Política de Privacidad"
            onPress={() => Linking.openURL('https://mailytcuida.com/privacidad')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="document"
            label="Términos y Condiciones"
            onPress={() => Linking.openURL('https://mailytcuida.com/terminos')}
          />
        </Card>

        {/* ── Sobre la app ── */}
        <Text style={styles.sectionLabel}>Sobre la app</Text>
        <Card>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Versión</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Entorno</Text>
            <Text style={styles.aboutValue}>Producción</Text>
          </View>
        </Card>

        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function PermRow({
  icon, label, desc, status, onToggle,
}: {
  icon: AppIconName; label: string; desc: string
  status: PermStatus; onToggle: () => void
}) {
  return (
    <View style={styles.permRow}>
      <IconBadge name={icon} size={18} />
      <View style={styles.permInfo}>
        <Text style={styles.permLabel}>{label}</Text>
        <Text style={styles.permDesc}>{desc}</Text>
        <Text style={[styles.permStatus, { color: statusColor(status) }]}>
          {statusLabel(status)}
        </Text>
      </View>
      <Switch
        value={status === 'granted'}
        onValueChange={onToggle}
        trackColor={{ false: Colors.light.border, true: Colors.brand.primary }}
        thumbColor="#fff"
        disabled={status === 'loading'}
      />
    </View>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  back:  { fontSize: 28, color: Colors.brand.primary, lineHeight: 32 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },
  content: { padding: 20, gap: 8 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.light.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12, marginBottom: 4,
  },
  card:    { gap: 0 },
  divider: { height: 1, backgroundColor: Colors.light.border },

  permRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  permInfo:  { flex: 1, gap: 2 },
  permLabel: { fontSize: 14, fontWeight: '600', color: Colors.light.textPrimary },
  permDesc:  { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },
  permStatus:{ fontSize: 11, fontWeight: '500', marginTop: 2 },

  aboutRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  aboutLabel:  { fontSize: 14, color: Colors.light.textSecondary },
  aboutValue:  { fontSize: 14, fontWeight: '600', color: Colors.light.textPrimary },
})
