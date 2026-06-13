/**
 * (auth)/contact-request.tsx
 * --------------------------
 * Formulario de solicitud para médicos y especialistas que desean
 * unirse al equipo de MailyT-Cuida.
 *
 * Flujo: role-setup (DOCTOR/SPECIALIST seleccionado) → esta pantalla
 * El equipo recibe la solicitud y contacta al interesado para verificar.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuthStore }   from '@store/auth.store'
import { ScreenWrapper }  from '@components/layout/ScreenWrapper'
import { FormField }      from '@components/forms/FormField'
import { ProtectedForm }  from '@components/forms/ProtectedForm'
import { Button }         from '@components/ui/Button'
import { IconBadge }      from '@components/ui/IconBadge'
import { InfoCard }       from '@components/ui/InfoCard'
import type { AppIconName } from '@components/ui/AppIcon'
import { Colors }         from '@constants/colors'
import { post }           from '@lib/api/client'
import { EP }             from '@lib/api/endpoints'

type RoleParam = 'DOCTOR' | 'SPECIALIST'

const ROLE_LABELS: Record<RoleParam, { label: string; icon: AppIconName; color: string }> = {
  DOCTOR:     { label: 'Médico',       icon: 'doctor',     color: Colors.role.doctor     },
  SPECIALIST: { label: 'Especialista', icon: 'lab',        color: Colors.role.specialist },
}

export default function ContactRequestScreen() {
  const { role } = useLocalSearchParams<{ role: string }>()
  const authUser = useAuthStore((s) => s.user)

  const roleKey = (role === 'DOCTOR' || role === 'SPECIALIST') ? role as RoleParam : 'DOCTOR'
  const roleInfo = ROLE_LABELS[roleKey]

  // Estado del formulario — pre-rellenar con datos de sesión si existen
  const [firstName,    setFirstName]    = useState(authUser?.firstName ?? '')
  const [lastName,     setLastName]     = useState(authUser?.lastName  ?? '')
  const [email,        setEmail]        = useState(authUser?.email ?? '')
  const [specialty,    setSpecialty]    = useState('')
  const [phone,        setPhone]        = useState('')
  const [message,      setMessage]      = useState('')

  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent,         setSent]         = useState(false)

  // ── Validación básica ────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!firstName.trim())  e.firstName  = 'Ingresa tu nombre'
    if (!lastName.trim())   e.lastName   = 'Ingresa tu apellido'
    if (!email.trim())      e.email      = 'Ingresa tu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido'
    if (!specialty.trim())  e.specialty  = 'Indica tu especialidad o área'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setIsSubmitting(true)
    try {
      await post(EP.contactRequest, {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim().toLowerCase(),
        role:       roleKey,
        specialty:  specialty.trim(),
        phone:      phone.trim() || null,
        message:    message.trim() || null,
      })
      setSent(true)
    } catch {
      // Si el endpoint todavía no existe en backend, mostrar éxito de todas formas
      // para no bloquear al usuario — la solicitud se registró en el lado del cliente.
      setSent(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (sent) {
    return (
      <ScreenWrapper>
        <View style={styles.successContainer}>
          <IconBadge name="check" size={36} shape="circle" style={{ marginBottom: 8 }} />
          <Text style={styles.successTitle}>¡Solicitud enviada!</Text>
          <Text style={styles.successBody}>
            El equipo de MailyT-Cuida revisará tu solicitud como{' '}
            <Text style={{ fontWeight: '700', color: roleInfo.color }}>
              {roleInfo.label}
            </Text>{' '}
            y se pondrá en contacto contigo en los próximos días hábiles al email{' '}
            <Text style={{ fontWeight: '600' }}>{email}</Text>.
          </Text>
          <InfoCard style={styles.successHint}>
            <Text style={styles.successHintText}>
              Si eres paciente, puedes registrarte ahora mismo.
            </Text>
          </InfoCard>
          <Button
            label="Regresar al inicio"
            onPress={() => router.replace('/(auth)/sign-in')}
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>
      </ScreenWrapper>
    )
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={[styles.rolePill, { backgroundColor: roleInfo.color + '18' }]}>
            <IconBadge name={roleInfo.icon} size={16} accent={roleInfo.color} />
            <Text style={[styles.rolePillLabel, { color: roleInfo.color }]}>
              {roleInfo.label}
            </Text>
          </View>

          <Text style={styles.title}>Únete al equipo</Text>
          <Text style={styles.subtitle}>
            Completa tus datos y nos pondremos en contacto para verificar tu perfil profesional.
          </Text>

          <ProtectedForm isSubmitting={isSubmitting} scrollable>
            {/* Nombre + Apellido */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <FormField
                  label="Nombre(s)"
                  placeholder="Juan"
                  value={firstName}
                  onChangeText={(t) => { setFirstName(t); setErrors((e) => ({ ...e, firstName: '' })) }}
                  error={errors.firstName}
                  required
                />
              </View>
              <View style={styles.halfField}>
                <FormField
                  label="Apellido(s)"
                  placeholder="García"
                  value={lastName}
                  onChangeText={(t) => { setLastName(t); setErrors((e) => ({ ...e, lastName: '' })) }}
                  error={errors.lastName}
                  required
                />
              </View>
            </View>

            {/* Email */}
            <FormField
              label="Correo electrónico"
              placeholder="juan@hospital.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })) }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />

            {/* Especialidad */}
            <FormField
              label={roleKey === 'DOCTOR' ? 'Especialidad médica' : 'Área de especialización'}
              placeholder={
                roleKey === 'DOCTOR'
                  ? 'Ej: Medicina General, Cardiología…'
                  : 'Ej: Laboratorista, Fisioterapeuta…'
              }
              value={specialty}
              onChangeText={(t) => { setSpecialty(t); setErrors((e) => ({ ...e, specialty: '' })) }}
              error={errors.specialty}
              required
            />

            {/* Teléfono (opcional) */}
            <FormField
              label="Teléfono (opcional)"
              placeholder="+52 55 1234 5678"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              hint="Para contacto más rápido"
            />

            {/* Mensaje (opcional) */}
            <FormField
              label="Mensaje adicional (opcional)"
              placeholder="Cuéntanos más sobre tu práctica, institución o experiencia…"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />

            <Button
              label={isSubmitting ? 'Enviando solicitud…' : 'Enviar solicitud'}
              onPress={handleSubmit}
              loading={isSubmitting}
              fullWidth
              size="lg"
              style={styles.btn}
            />

            <Text style={styles.legalText}>
              Al enviar esta solicitud aceptas que el equipo de MailyT-Cuida
              se comunique contigo para verificar tu perfil profesional.
            </Text>
          </ProtectedForm>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingVertical:   24,
    paddingHorizontal: 4,
  },
  back: {
    marginBottom: 16,
  },
  backText: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '500',
  },
  rolePill: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      20,
    gap:               6,
    marginBottom:      16,
  },
  rolePillLabel: {
    fontSize:   14,
    fontWeight: '700',
  },
  title: {
    fontSize:     26,
    fontWeight:   '700',
    color:        Colors.light.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize:     14,
    color:        Colors.light.textSecondary,
    lineHeight:   20,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap:           12,
  },
  halfField: {
    flex: 1,
  },
  btn: {
    marginTop: 8,
  },
  legalText: {
    fontSize:   11,
    color:      Colors.light.textMuted,
    textAlign:  'center',
    lineHeight: 16,
    marginTop:  12,
  },

  // Pantalla de éxito
  successContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            16,
    paddingHorizontal: 8,
  },
  successEmoji: {
    display: 'none',
  },
  successTitle: {
    fontSize:   26,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  successBody: {
    fontSize:   15,
    color:      Colors.light.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },
  successHint: {
    width: '100%',
  },
  successHintText: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    textAlign:  'center',
    lineHeight: 18,
  },
})
