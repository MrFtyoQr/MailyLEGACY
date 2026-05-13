/**
 * role-setup.tsx
 * --------------
 * Pantalla para completar el perfil tras el primer login.
 * 1. Selección de rol con cards animadas (spring al tap)
 * 2. Formulario mínimo según rol
 * 3. POST /api/v1/auth/profiles/{role}/ para crear el perfil
 *
 * Roles disponibles: PATIENT, DOCTOR, SPECIALIST
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'

import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { FormField }     from '@components/forms/FormField'
import { ProtectedForm } from '@components/forms/ProtectedForm'
import { Button }        from '@components/ui/Button'
import { useFormGuard }  from '@hooks/useFormGuard'
import { createRateLimiter } from '@lib/security/rateLimiter'
import { post }        from '@lib/api/client'
import { EP }           from '@lib/api/endpoints'
import {
  patientProfileSchema,
  doctorProfileSchema,
  specialistProfileSchema,
  type PatientProfileForm,
  type DoctorProfileForm,
  type SpecialistProfileForm,
} from '@schemas/auth.schema'
import { Colors } from '@constants/colors'

const { width } = Dimensions.get('window')
const setupLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })

type RoleId = 'PATIENT' | 'DOCTOR' | 'SPECIALIST'

interface RoleCard {
  id:      RoleId
  emoji:   string
  label:   string
  desc:    string
  color:   string
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

function RoleCardItem({
  card,
  selected,
  onSelect,
}: {
  card: RoleCard
  selected: boolean
  onSelect: () => void
}) {
  const scale = useSharedValue(1)
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

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
      </TouchableOpacity>
    </Animated.View>
  )
}

// ---------------------------------------------------------------------------
// Campos comunes
// ---------------------------------------------------------------------------

function BaseFields({
  firstName, setFirstName,
  lastName, setLastName,
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

// ---------------------------------------------------------------------------
// Pantalla principal
// ---------------------------------------------------------------------------

export default function RoleSetupScreen() {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null)
  const [step, setStep] = useState<'role' | 'profile'>('role')

  // Campos
  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [birthDate,     setBirthDate]     = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [specialty,     setSpecialty]     = useState('')
  const [specialtyType, setSpecialtyType] = useState('')

  // Patient
  const { submit: submitPatient, isSubmitting: subPatient, formError: errPatient,
          fieldErrors: fePatient, clearErrors: clearPatient } =
    useFormGuard<PatientProfileForm, PatientProfileForm>({
      schema:      patientProfileSchema,
      rateLimiter: setupLimiter,
      onSubmit: async (data) => {
        await post(EP.profileCreate('patient'), {
          first_name: data.firstName,
          last_name:  data.lastName,
          birth_date: data.birthDate,
        })
        router.replace('/(patient)')
      },
    })

  // Doctor
  const { submit: submitDoctor, isSubmitting: subDoctor, formError: errDoctor,
          fieldErrors: feDoctor, clearErrors: clearDoctor } =
    useFormGuard<DoctorProfileForm, DoctorProfileForm>({
      schema:      doctorProfileSchema,
      rateLimiter: setupLimiter,
      onSubmit: async (data) => {
        await post(EP.profileCreate('doctor'), {
          first_name:     data.firstName,
          last_name:      data.lastName,
          license_number: data.licenseNumber,
          specialty:      data.specialty,
        })
        router.replace('/(doctor)')
      },
    })

  // Specialist
  const { submit: submitSpecialist, isSubmitting: subSpecialist, formError: errSpecialist,
          fieldErrors: feSpecialist, clearErrors: clearSpecialist } =
    useFormGuard<SpecialistProfileForm, SpecialistProfileForm>({
      schema:      specialistProfileSchema,
      rateLimiter: setupLimiter,
      onSubmit: async (data) => {
        await post(EP.profileCreate('specialist'), {
          first_name:     data.firstName,
          last_name:      data.lastName,
          specialty_type: data.specialtyType,
          license_number: data.licenseNumber,
        })
        router.replace('/(specialist)')
      },
    })

  const isSubmitting = subPatient || subDoctor || subSpecialist

  const handleSubmit = () => {
    if (selectedRole === 'PATIENT') {
      submitPatient({ role: 'PATIENT', firstName, lastName, birthDate } as never)
    } else if (selectedRole === 'DOCTOR') {
      submitDoctor({ role: 'DOCTOR', firstName, lastName, licenseNumber, specialty } as never)
    } else if (selectedRole === 'SPECIALIST') {
      submitSpecialist({ role: 'SPECIALIST', firstName, lastName, specialtyType, licenseNumber } as never)
    }
  }

  const currentFormError =
    selectedRole === 'PATIENT' ? errPatient :
    selectedRole === 'DOCTOR'  ? errDoctor  :
    errSpecialist

  const currentFieldErrors: Record<string, string | undefined> =
    selectedRole === 'PATIENT' ? fePatient as never :
    selectedRole === 'DOCTOR'  ? feDoctor  as never :
    feSpecialist as never

  const clearCurrent = () => {
    clearPatient(); clearDoctor(); clearSpecialist()
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

          <Button
            label="Continuar"
            onPress={() => { if (selectedRole) setStep('profile') }}
            disabled={!selectedRole}
            fullWidth
            size="lg"
            style={styles.btn}
          />
        </ScrollView>
      </ScreenWrapper>
    )
  }

  // ---- Paso 2: Formulario según rol ----
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
        <Text style={styles.subtitle}>
          Solo unos datos más para empezar
        </Text>

        <ProtectedForm error={currentFormError} isSubmitting={isSubmitting} scrollable>
          <BaseFields
            firstName={firstName} setFirstName={setFirstName}
            lastName={lastName}   setLastName={setLastName}
            errors={currentFieldErrors}
            clearErrors={clearCurrent}
          />

          {selectedRole === 'PATIENT' && (
            <FormField
              label="Fecha de nacimiento"
              placeholder="YYYY-MM-DD"
              value={birthDate}
              onChangeText={(t) => { clearCurrent(); setBirthDate(t) }}
              error={currentFieldErrors.birthDate}
              keyboardType="numeric"
              required
              hint="Formato: AAAA-MM-DD"
            />
          )}

          {selectedRole === 'DOCTOR' && (
            <>
              <FormField
                label="Cédula profesional"
                placeholder="Ej: 12345678"
                value={licenseNumber}
                onChangeText={(t) => { clearCurrent(); setLicenseNumber(t) }}
                error={currentFieldErrors.licenseNumber}
                required
              />
              <FormField
                label="Especialidad"
                placeholder="Ej: Medicina General"
                value={specialty}
                onChangeText={(t) => { clearCurrent(); setSpecialty(t) }}
                error={currentFieldErrors.specialty}
                required
              />
            </>
          )}

          {selectedRole === 'SPECIALIST' && (
            <>
              <FormField
                label="Tipo de especialidad"
                placeholder="Ej: Laboratorista, Terapeuta..."
                value={specialtyType}
                onChangeText={(t) => { clearCurrent(); setSpecialtyType(t) }}
                error={currentFieldErrors.specialtyType}
                required
              />
              <FormField
                label="Cédula profesional"
                placeholder="Ej: 12345678"
                value={licenseNumber}
                onChangeText={(t) => { clearCurrent(); setLicenseNumber(t) }}
                error={currentFieldErrors.licenseNumber}
                required
              />
            </>
          )}

          <Button
            label="Guardar y continuar"
            onPress={handleSubmit}
            loading={isSubmitting}
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
    fontSize:      15,
    color:         Colors.light.textSecondary,
    marginBottom:  28,
  },
  roleList: {
    gap:          12,
    marginBottom: 28,
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
  roleEmoji: {
    fontSize: 32,
  },
  roleText: {
    flex: 1,
    gap:  2,
  },
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
  back: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 14,
    color:    Colors.brand.primary,
    fontWeight: '500',
  },
  btn: {
    marginTop: 8,
  },
})
