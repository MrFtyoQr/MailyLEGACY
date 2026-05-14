/**
 * sign-in.tsx
 * -----------
 * Pantalla de inicio de sesión.
 * Solo OAuth: Google + Apple.
 * Sin formulario de email/contraseña.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useOAuth, useAuth } from '@clerk/clerk-expo'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors }        from '@constants/colors'

WebBrowser.maybeCompleteAuthSession()

const { width } = Dimensions.get('window')

export default function SignInScreen() {
  const { startOAuthFlow: googleFlow } = useOAuth({ strategy: 'oauth_google' })
  const { startOAuthFlow: appleFlow  } = useOAuth({ strategy: 'oauth_apple'  })
  const { isSignedIn }                 = useAuth()
  const [loading, setLoading]          = useState<'google' | 'apple' | null>(null)

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const flow = provider === 'google' ? googleFlow : appleFlow
    setLoading(provider)
    try {
      const redirectUrl = Linking.createURL('/')
      const result = await flow({ redirectUrl })

      const { createdSessionId, setActive } = result

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
      }

      // Navegar siempre: si no hay createdSessionId, Clerk ya tenía sesión activa.
      // El splash (app/index.tsx) evalúa el estado real y redirige al destino correcto.
      router.replace('/')
    } catch (err: unknown) {
      const msg = (err instanceof Error) ? err.message : String(err)

      // Clerk lanza este error si ya hay sesión activa → ir directo al home
      if (msg.includes('already signed in') || msg.includes('You\'re already signed in')) {
        router.replace('/')
        return
      }

      // Loguear errores inesperados
      console.error('[OAuth] Error en flujo OAuth:', err)

      // Mostrar error solo si no fue cancelación del usuario
      const isCancelled = msg.includes('cancel') || msg.includes('dismiss') || msg === ''
      if (!isCancelled) {
        Alert.alert(
          'Error al iniciar sesión',
          `No se pudo completar el inicio de sesión.\n\n${msg}`,
          [{ text: 'Entendido' }],
        )
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>

        {/* ── Header / Marca ─────────────────────────────── */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Bienvenido a maily</Text>
          <Text style={styles.subtitle}>
            Tu salud y la de tu familia, siempre conectada
          </Text>
        </View>

        {/* ── Botones OAuth ──────────────────────────────── */}
        <View style={styles.buttons}>

          {/* Google */}
          <TouchableOpacity
            style={[styles.oauthBtn, loading === 'google' && styles.oauthBtnDisabled]}
            onPress={() => handleOAuth('google')}
            activeOpacity={0.85}
            disabled={loading !== null}
          >
            <View style={styles.oauthIcon}>
              <Text style={styles.googleG}>G</Text>
            </View>
            <Text style={styles.oauthLabel}>
              {loading === 'google' ? 'Conectando…' : 'Continuar con Google'}
            </Text>
          </TouchableOpacity>

          {/* Apple — solo en iOS */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.oauthBtn, styles.oauthBtnApple,
                      loading === 'apple' && styles.oauthBtnDisabled]}
              onPress={() => handleOAuth('apple')}
              activeOpacity={0.85}
              disabled={loading !== null}
            >
              <Text style={styles.appleIcon}></Text>
              <Text style={[styles.oauthLabel, styles.oauthLabelApple]}>
                {loading === 'apple' ? 'Conectando…' : 'Continuar con Apple'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Footer legal ───────────────────────────────── */}
        <Text style={styles.legal}>
          Al continuar aceptas nuestros{' '}
          <Text style={styles.legalLink}>Términos de uso</Text>
          {' '}y{' '}
          <Text style={styles.legalLink}>Política de privacidad</Text>
        </Text>

      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    paddingHorizontal: 28,
    justifyContent:    'space-between',
    paddingVertical:   48,
  },
  header: {
    alignItems: 'center',
    gap:         12,
    marginTop:   16,
  },
  logo: {
    width:        width * 0.55,
    height:       90,
    marginBottom: 12,
  },
  title: {
    fontSize:   26,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:  15,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Botones ───────────────────────────────────────────
  buttons: {
    gap:           14,
    paddingBottom: 8,
  },
  oauthBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     Colors.light.border,
    backgroundColor: Colors.light.surface,
    gap:             14,
  },
  oauthBtnApple: {
    backgroundColor: '#000000',
    borderColor:     '#000000',
  },
  oauthBtnDisabled: {
    opacity: 0.6,
  },
  oauthIcon: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: '#FFF',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.light.border,
  },
  googleG: {
    fontSize:   18,
    fontWeight: '700',
    color:      '#4285F4',
  },
  appleIcon: {
    fontSize:   22,
    color:      '#FFFFFF',
    lineHeight: 26,
    width:      32,
    textAlign:  'center',
  },
  oauthLabel: {
    flex:       1,
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
    marginRight: 32,
  },
  oauthLabelApple: {
    color: '#FFFFFF',
  },

  // ── Legal ─────────────────────────────────────────────
  legal: {
    fontSize:  12,
    color:     Colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color:      Colors.brand.primary,
    fontWeight: '500',
  },
})
