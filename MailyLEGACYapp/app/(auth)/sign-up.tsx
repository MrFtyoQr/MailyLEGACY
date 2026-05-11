/**
 * sign-up.tsx
 * -----------
 * Registro en 2 pasos:
 *   Paso 1: email + contraseña + confirmación + indicador de fuerza
 *   Paso 2: verificación de código de 6 dígitos enviado por Clerk
 *
 * Rate limit: 2 intentos / 60s (más estricto que sign-in)
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import { useSignUp } from '@clerk/clerk-expo'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'

import { ScreenWrapper }  from '@components/layout/ScreenWrapper'
import { FormField }      from '@components/forms/FormField'
import { ProtectedForm }  from '@components/forms/ProtectedForm'
import { Button }         from '@components/ui/Button'
import { useFormGuard }   from '@hooks/useFormGuard'
import { createRateLimiter } from '@lib/security/rateLimiter'
import {
  signUpSchema,
  verifyEmailSchema,
  getPasswordStrength,
  type SignUpForm,
  type VerifyEmailForm,
} from '@schemas/auth.schema'
import { Colors } from '@constants/colors'

const { width } = Dimensions.get('window')

const signUpLimiter  = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
const verifyLimiter  = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp()

  const [step,     setStep]     = useState<'account' | 'verify'>('account')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [code,     setCode]     = useState('')

  // Fuerza de contraseña
  const strength   = getPasswordStrength(password)
  const barWidth   = useSharedValue(0)
  const barColor   = useSharedValue<string>(Colors.semantic.error)

  const barStyle = useAnimatedStyle(() => ({
    width:           `${barWidth.value}%` as never,
    backgroundColor: barColor.value,
  }))

  const updateStrength = (pw: string) => {
    setPassword(pw)
    const s = getPasswordStrength(pw)
    barWidth.value  = withTiming((s.score / 4) * 100, { duration: 300 })
    barColor.value  = withTiming(s.color, { duration: 300 })
  }

  // ---- Paso 1: Crear cuenta ----
  const { submit: submitAccount, isSubmitting: submittingAccount,
          formError: accountError, fieldErrors: accountFieldErrors, clearErrors: clearAccount } =
    useFormGuard<SignUpForm, SignUpForm>({
      schema:      signUpSchema,
      rateLimiter: signUpLimiter,
      onSubmit: async (data) => {
        if (!signUp) return
        await signUp.create({ emailAddress: data.email, password: data.password })
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setStep('verify')
      },
    })

  // ---- Paso 2: Verificar código ----
  const { submit: submitVerify, isSubmitting: submittingVerify,
          formError: verifyError, fieldErrors: verifyFieldErrors, clearErrors: clearVerify } =
    useFormGuard<VerifyEmailForm, VerifyEmailForm>({
      schema:      verifyEmailSchema,
      rateLimiter: verifyLimiter,
      onSubmit: async (data) => {
        if (!signUp) return
        const result = await signUp.attemptEmailAddressVerification({ code: data.code })
        if (result.status === 'complete') {
          await setActive!({ session: result.createdSessionId })
          router.replace('/(auth)/onboarding')
        }
      },
    })

  // ---------------------------------------------------------------------------
  // Paso 1 UI
  // ---------------------------------------------------------------------------
  if (step === 'account') {
    return (
      <ScreenWrapper>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.header}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Únete a la comunidad T-Cuida</Text>
          </View>

          <ProtectedForm error={accountError} isSubmitting={submittingAccount}>
            <FormField
              label="Correo electrónico"
              placeholder="tu@correo.com"
              value={email}
              onChangeText={(t) => { clearAccount(); setEmail(t) }}
              error={accountFieldErrors.email}
              keyboardType="email-address"
              autoComplete="email"
              required
            />
            <FormField
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChangeText={(t) => { clearAccount(); updateStrength(t) }}
              error={accountFieldErrors.password}
              secureTextEntry
              required
            />

            {/* Indicador de fuerza */}
            {password.length > 0 && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthTrack}>
                  <Animated.View style={[styles.strengthBar, barStyle]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}

            <FormField
              label="Confirmar contraseña"
              placeholder="Repite tu contraseña"
              value={confirm}
              onChangeText={(t) => { clearAccount(); setConfirm(t) }}
              error={accountFieldErrors.confirmPassword}
              secureTextEntry
              required
            />

            <Button
              label="Crear cuenta"
              onPress={() => submitAccount({ email, password, confirmPassword: confirm } as never)}
              loading={submittingAccount || !isLoaded}
              fullWidth
              size="lg"
              style={styles.btn}
            />
          </ProtectedForm>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenWrapper>
    )
  }

  // ---------------------------------------------------------------------------
  // Paso 2: Verificación de email
  // ---------------------------------------------------------------------------
  return (
    <ScreenWrapper>
      <View style={styles.verifyContainer}>
        <Text style={styles.verifyEmoji}>📧</Text>
        <Text style={styles.title}>Verifica tu correo</Text>
        <Text style={styles.subtitle}>
          Enviamos un código de 6 dígitos a{'\n'}
          <Text style={styles.emailBold}>{email}</Text>
        </Text>

        <ProtectedForm error={verifyError} isSubmitting={submittingVerify} style={styles.verifyForm}>
          <FormField
            label="Código de verificación"
            placeholder="000000"
            value={code}
            onChangeText={(t) => { clearVerify(); setCode(t.replace(/\D/g, '')) }}
            error={verifyFieldErrors.code}
            keyboardType="number-pad"
            maxLength={6}
            required
          />

          <Button
            label="Verificar correo"
            onPress={() => submitVerify({ code } as never)}
            loading={submittingVerify}
            fullWidth
            size="lg"
          />
        </ProtectedForm>

        <TouchableOpacity
          style={styles.resend}
          onPress={() => signUp?.prepareEmailAddressVerification({ strategy: 'email_code' })}
        >
          <Text style={styles.resendText}>¿No llegó el código? Reenviar</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingVertical:   32,
    paddingHorizontal: 4,
  },
  header: {
    alignItems:   'center',
    marginBottom: 32,
    gap:          8,
  },
  logo: {
    width:        width * 0.45,
    height:       80,
    marginBottom: 8,
  },
  title: {
    fontSize:   26,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  subtitle: {
    fontSize:  15,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailBold: {
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     -8,
    marginBottom:  12,
  },
  strengthTrack: {
    flex:            1,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.light.border,
    overflow:        'hidden',
  },
  strengthBar: {
    height:       4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize:   12,
    fontWeight: '600',
    minWidth:   72,
  },
  btn: {
    marginTop: 8,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'center',
    marginTop:      28,
  },
  footerText: {
    fontSize: 14,
    color:    Colors.light.textSecondary,
  },
  footerLink: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '600',
  },
  // Verify step
  verifyContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap:            12,
  },
  verifyEmoji: {
    fontSize: 56,
  },
  verifyForm: {
    width:     '100%',
    marginTop: 16,
  },
  resend: {
    marginTop: 16,
  },
  resendText: {
    fontSize:  14,
    color:     Colors.brand.primary,
    fontWeight: '500',
  },
})
