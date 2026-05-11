/**
 * sign-in.tsx
 * -----------
 * Pantalla de inicio de sesión.
 * - Clerk useSignIn
 * - Validación Zod + sanitización
 * - Rate limit: 3 intentos / 30s
 * - Google OAuth
 * - Mensajes de error en español
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
import { useSignIn, useOAuth } from '@clerk/clerk-expo'
import * as WebBrowser from 'expo-web-browser'

import { ScreenWrapper }  from '@components/layout/ScreenWrapper'
import { FormField }      from '@components/forms/FormField'
import { ProtectedForm }  from '@components/forms/ProtectedForm'
import { Button }         from '@components/ui/Button'
import { useFormGuard }   from '@hooks/useFormGuard'
import { createRateLimiter } from '@lib/security/rateLimiter'
import { signInSchema, type SignInForm } from '@schemas/auth.schema'
import { Colors }         from '@constants/colors'

WebBrowser.maybeCompleteAuthSession()

const { width } = Dimensions.get('window')

// Rate limiter: 3 intentos por 30 segundos
const signInLimiter = createRateLimiter({ maxAttempts: 3, windowMs: 30_000 })

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  const { submit, isSubmitting, formError, fieldErrors, clearErrors } =
    useFormGuard<SignInForm, SignInForm>({
      schema:      signInSchema,
      rateLimiter: signInLimiter,
      onSubmit: async (data) => {
        if (!signIn) return
        const result = await signIn.create({
          identifier: data.email,
          password:   data.password,
        })
        if (result.status === 'complete') {
          await setActive!({ session: result.createdSessionId })
          router.replace('/')
        }
      },
    })

  const handleGoogleAuth = async () => {
    try {
      const { createdSessionId, setActive: setActiveOAuth } = await startOAuthFlow()
      if (createdSessionId) {
        await setActiveOAuth!({ session: createdSessionId })
        router.replace('/')
      }
    } catch {
      // El usuario canceló o hubo un error
    }
  }

  return (
    <ScreenWrapper>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Bienvenido de vuelta</Text>
          <Text style={styles.subtitle}>Inicia sesión en tu cuenta</Text>
        </View>

        {/* Formulario */}
        <ProtectedForm error={formError} isSubmitting={isSubmitting}>
          <FormField
            label="Correo electrónico"
            placeholder="tu@correo.com"
            value={email}
            onChangeText={(t) => { clearErrors(); setEmail(t) }}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoComplete="email"
            required
          />
          <FormField
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChangeText={(t) => { clearErrors(); setPassword(t) }}
            error={fieldErrors.password}
            secureTextEntry
            required
          />

          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => { /* TODO: forgot password */ }}
          >
            <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <Button
            label="Iniciar sesión"
            onPress={() => submit({ email, password } as never)}
            loading={isSubmitting || !isLoaded}
            fullWidth
            size="lg"
            style={styles.btnPrimary}
          />
        </ProtectedForm>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>o continúa con</Text>
          <View style={styles.line} />
        </View>

        {/* Google OAuth */}
        <Button
          variant="secondary"
          label="Google"
          onPress={handleGoogleAuth}
          fullWidth
          size="lg"
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text style={styles.footerLink}>Regístrate</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    alignItems:    'center',
    marginBottom:  36,
    gap:           8,
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
    fontSize: 15,
    color:    Colors.light.textSecondary,
  },
  forgotWrap: {
    alignSelf:   'flex-end',
    marginTop:   -8,
    marginBottom: 20,
  },
  forgot: {
    fontSize: 13,
    color:    Colors.brand.primary,
    fontWeight: '500',
  },
  btnPrimary: {
    marginTop: 4,
  },
  divider: {
    flexDirection:  'row',
    alignItems:     'center',
    marginVertical: 24,
    gap:            12,
  },
  line: {
    flex:            1,
    height:          1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    fontSize: 13,
    color:    Colors.light.textMuted,
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
})
