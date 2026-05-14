/**
 * role-setup.tsx
 * --------------
 * Pantalla para completar el perfil tras el primer login.
 *
 * FLUJOS:
 *   PATIENT    → formulario de perfil (nombre + fecha nacimiento) → POST /auth/profiles/patient/
 *   DOCTOR     → redirige a /(auth)/contact-request (solicitud al equipo)
 *   SPECIALIST → redirige a /(auth)/contact-request (solicitud al equipo)
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
} from 'react-native'
import { router } from 'expo-router'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'

import { ScreenWrapper }   from '@components/layout/ScreenWrapper'
import { FormField }       from '@components/forms/FormField'
import { ProtectedForm }   from '@components/forms/ProtectedForm'
import { Button }          from '@components/ui/Button'
import { useFormGuard }    from '@hooks/useFormGuard'
import { createRateLimiter } from '@lib/security/rateLimiter'
import { patch }           from '@lib/api/client'
import { EP }              from '@lib/api/endpoints'
import {
  patientProfileSchema,
  type PatientProfileForm,
} from '@schemas/auth.schema'
import { Colors } from '@constants/colors'

const { width } = Dimensions.get('window')
const setupLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })

type RoleId = 'PATIENT' | 'DOCTOR' | 'SPECIALIST'

interface RoleCard {
  id:    RoleId
  emoji: string
  label: string
  desc:  string
  color: string
}

const ROLES: RoleCard[] = [
  {
    id:    'PATIENT',
    emoji: '🙋',
    label: 'Paciente',
    desc:  'Gestiona tu salud y la de tu familia',
    color: Colors.role.patient,
  },
  {
    id:    'DOCTOR',
    emoji: '👨‍⚕️',
    label: 'Médico',
    desc:  'Consulta y seguimiento de pacientes',
    color: Colors.role.doctor,
  },
  {
    id:    'SPECIALIST',
    emoji: '🔬',
    label: 'Especialista',
    desc:  'Laboratorista, terapeuta u otro especialista',
    color: Colors.role.specialist,
  },
]

// ── Role card con animación spring ──────────────────────────────────────────
function RoleCardItem({
  card,
  selected,
  onSelect,
}: {
  card:     RoleCard
  selected: boolean
  onSelect: () => void
}) {
  const scale  = useSharedValue(1)
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={aStyle}>
      <TouchableOpacity
        style={[
          styles.roleCard,
          selected && { borderColor: card.color, borderWidth: 2.5 },
        ]}
        onPress={() => {
          scale.value = withSpring(0.95, { damping: 10 }, () => {
            scale.value = withSpring(1)
          })
          onSelect()
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.roleEmoji}>{card.emoji}</Text>
        <View style={styles.roleText}>
          <Text style={[styles.roleLabel, selected && { color: card.color }]}>
            {card.label}
          </Text>
          <Text style={styles.roleDesc}>{card.desc}</Text>
        </View>
        {selected && (
          <View style={[styles.check, { backgroundColor: card.color }]}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
        {(card.id === 'DOCTOR' || card.id === 'SPECIALIST') && (
          <View style={styles.requestBadge}>
            <Text style={styles.requestBadgeText}>Solicitud</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Date Picker inline ───────────────────────────────────────────────────────
function BirthDatePicker({
  value,
  onChange,
  error,
}: {
  value:    Date | null
  onChange: (date: Date) => void
  error?:   string
}) {
  const [show, setShow] = useState(false)
  const maxDate = new Date()
  maxDate.setFullYear(maxDate.getFullYear() - 1)   // al menos 1 año de edad

  const displayStr = value
    ? value.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Seleccionar fecha'

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShow(false)
    if (selected) onChange(selected)
  }

  return (
    <View style={dp.wrapper}>
      <View style={dp.labelRow}>
        <Text style={dp.label}>Fecha de nacimiento</Text>
        <Text style={dp.required}> *</Text>
      </View>

      <TouchableOpacity
        style={[dp.field, error ? dp.fieldError : null]}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Text style={[dp.fieldText, !value && dp.placeholder]}>
          {displayStr}
        </Text>
        <Text style={dp.calIcon}>📅</Text>
      </TouchableOpacity>

      {error ? (
        <Text style={dp.errorText}>{error}</Text>
      ) : (
        <Text style={dp.hint}>Toca para abrir el selector de fecha</Text>
      )}

      {/* Android: diálogo nativo directo */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={value ?? new Date(2000, 0, 1)}
          mode="date"
          display="default"
          maximumDate={maxDate}
          onChange={handleChange}
          locale="es-MX"
        />
      )}

      {/* iOS: modal con spinner (rueda de scroll) */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={dp.modalOverlay}>
            <View style={dp.modalSheet}>
              <View style={dp.modalHeader}>
                <TouchableOpacity onPress={() => setShow(false)} activeOpacity={0.7}>
                  <Text style={dp.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={dp.modalTitle}>Fecha de nacimiento</Text>
                <TouchableOpacity onPress={() => setShow(false)} activeOpacity={0.7}>
                  <Text style={dp.modalDone}>Listo</Text>
                </TouchableOpacity>
              </View>
              <View style={dp.pickerWrap}>
                <DateTimePicker
                  value={value ?? new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={maxDate}
                  onChange={handleChange}
                  locale="es-MX"
                  style={dp.picker}
                  textColor="#000000"
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const dp = StyleSheet.create({
  wrapper:   { marginBottom: 4 },
  labelRow:  { flexDirection: 'row', marginBottom: 6 },
  label:     { fontSize: 14, fontWeight: '500', color: Colors.light.textPrimary },
  required:  { color: Colors.semantic.error, fontWeight: '600' },
  field: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   Colors.light.surface,
    borderWidth:       1.5,
    borderColor:       Colors.light.border,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   14,
  },
  fieldError: {
    borderColor: Colors.semantic.error,
  },
  fieldText:   { fontSize: 15, color: Colors.light.textPrimary, flex: 1 },
  placeholder: { color: Colors.light.textMuted },
  calIcon:     { fontSize: 18 },
  hint:        { marginTop: 4, fontSize: 12, color: Colors.light.textSecondary },
  errorText:   { marginTop: 4, fontSize: 12, color: Colors.semantic.error },

  // Modal iOS
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.light.bg,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingBottom:        Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle:  { fontSize: 16, fontWeight: '600', color: Colors.light.textPrimary },
  modalCancel: { fontSize: 15, color: Colors.light.textSecondary },
  modalDone:   { fontSize: 15, fontWeight: '700', color: Colors.brand.primary },
  pickerWrap:  { backgroundColor: '#FFFFFF', borderRadius: 8, overflow: 'hidden' },
  picker:      { height: 216 },
})

// ── Campos comunes (nombre/apellido) ─────────────────────────────────────────
function BaseFields({
  firstName, setFirstName,
  lastName,  setLastName,
  errors,
  clearErrors,
}: {
  firstName: string; setFirstName: (v: string) => void
  lastName:  string; setLastName:  (v: string) => void
  errors:    Record<string, string | undefined>
  clearErrors: () => void
}) {
  return (
    <>
      <FormField
        label="Nombre(s)"
        placeholder="Juan"
        value={firstName}
        onChangeText={(t) => { clearErrors(); setFirstName(t) }}
        error={errors.firstName}
        required
      />
      <FormField
        label="Apellido(s)"
        placeholder="García"
        value={lastName}
        onChangeText={(t) => { clearErrors(); setLastName(t) }}
        error={errors.lastName}
        required
      />
    </>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function RoleSetupScreen() {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null)
  const [step,         setStep]         = useState<'role' | 'profile'>('role')

  // Campos del paciente
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [birthDate, setBirthDate] = useState<Date | null>(null)

  const { submit: submitPatient, isSubmitting, formError, fieldErrors, clearErrors } =
    useFormGuard<PatientProfileForm, PatientProfileForm>({
      schema:      patientProfileSchema,
      rateLimiter: setupLimiter,
      onSubmit: async (data) => {
        await patch(EP.profilePatient, {
          first_name: data.firstName,
          last_name:  data.lastName,
          birth_date: data.birthDate,   // YYYY-MM-DD string
        })
        router.replace('/(patient)')
      },
    })

  function handleContinue() {
    if (!selectedRole) return
    if (selectedRole === 'PATIENT') {
      setStep('profile')
    } else {
      // DOCTOR / SPECIALIST → flujo de solicitud de contacto
      router.push({
        pathname: '/(auth)/contact-request',
        params:   { role: selectedRole },
      })
    }
  }

  function handleSubmitPatient() {
    if (!birthDate) return
    // Convertir Date → "YYYY-MM-DD"
    const y   = birthDate.getFullYear()
    const m   = String(birthDate.getMonth() + 1).padStart(2, '0')
    const d   = String(birthDate.getDate()).padStart(2, '0')
    const str = `${y}-${m}-${d}`
    submitPatient({ role: 'PATIENT', firstName, lastName, birthDate: str } as never)
  }

  // ---- Paso 1: Selección de rol ----
  if (step === 'role') {
    return (
      <ScreenWrapper>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>¿Cuál es tu perfil?</Text>
          <Text style={styles.subtitle}>
            Esto personaliza tu experiencia en la app
          </Text>

          <View style={styles.roleList}>
            {ROLES.map((card) => (
              <RoleCardItem
                key={card.id}
                card={card}
                selected={selectedRole === card.id}
                onSelect={() => setSelectedRole(card.id)}
              />
            ))}
          </View>

          {/* Nota para médicos/especialistas */}
          {(selectedRole === 'DOCTOR' || selectedRole === 'SPECIALIST') && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Los médicos y especialistas pasan por un proceso de verificación antes de unirse al equipo. Te contactaremos en breve.
              </Text>
            </View>
          )}

          <Button
            label={
              selectedRole === 'DOCTOR' || selectedRole === 'SPECIALIST'
                ? 'Enviar solicitud →'
                : 'Continuar'
            }
            onPress={handleContinue}
            disabled={!selectedRole}
            fullWidth
            size="lg"
            style={styles.btn}
          />
        </ScrollView>
      </ScreenWrapper>
    )
  }

  // ---- Paso 2: Formulario de paciente ----
  return (
    <ScreenWrapper>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => setStep('role')} style={styles.back}>
          <Text style={styles.backText}>← Cambiar perfil</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Completa tu perfil</Text>
        <Text style={styles.subtitle}>Solo unos datos más para empezar</Text>

        <ProtectedForm error={formError} isSubmitting={isSubmitting} scrollable>
          <BaseFields
            firstName={firstName} setFirstName={setFirstName}
            lastName={lastName}   setLastName={setLastName}
            errors={fieldErrors as Record<string, string | undefined>}
            clearErrors={clearErrors}
          />

          <BirthDatePicker
            value={birthDate}
            onChange={(d) => { clearErrors(); setBirthDate(d) }}
            error={(fieldErrors as Record<string, string | undefined>).birthDate}
          />

          <Button
            label="Guardar y continuar"
            onPress={handleSubmitPatient}
            loading={isSubmitting}
            disabled={!birthDate}
            fullWidth
            size="lg"
            style={styles.btn}
          />
        </ProtectedForm>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingVertical:   32,
    paddingHorizontal: 4,
  },
  title: {
    fontSize:     26,
    fontWeight:   '700',
    color:        Colors.light.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize:     15,
    color:        Colors.light.textSecondary,
    marginBottom: 28,
  },
  roleList: {
    gap:          12,
    marginBottom: 16,
  },
  roleCard: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         16,
    borderRadius:    16,
    backgroundColor: Colors.light.surface,
    borderWidth:     1.5,
    borderColor:     Colors.light.border,
    gap:             12,
  },
  roleEmoji: { fontSize: 32 },
  roleText:  { flex: 1, gap: 2 },
  roleLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  roleDesc: {
    fontSize: 13,
    color:    Colors.light.textSecondary,
  },
  check: {
    width:          24,
    height:         24,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  checkText: {
    color:      '#FFF',
    fontSize:   13,
    fontWeight: '700',
  },
  requestBadge: {
    backgroundColor:   Colors.light.border,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      8,
  },
  requestBadgeText: {
    fontSize:   11,
    color:      Colors.light.textMuted,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: Colors.light.surface,
    borderRadius:    12,
    padding:         14,
    marginBottom:    16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.primary,
  },
  infoText: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    lineHeight: 18,
  },
  back: {
    marginBottom: 16,
  },
  backText: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '500',
  },
  btn: {
    marginTop: 8,
  },
})
