/**
 * Estilos compartidos para pantallas de perfil (paciente, médico, especialista).
 */

import { StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'

export const PROFILE_MENU_DIVIDER_MARGIN = 64

export const profileStyles = StyleSheet.create({
  profileHeader: {
    alignItems:        'center',
    paddingTop:        24,
    paddingBottom:     20,
    gap:               8,
    backgroundColor:   Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  name: {
    fontSize:   22,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    marginTop:  4,
  },
  email: {
    fontSize: 14,
    color:    Colors.light.textSecondary,
  },
  content: {
    gap:           16,
    padding:       20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize:      14,
    fontWeight:    '700',
    color:         Colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  version: {
    fontSize:  12,
    color:     Colors.light.textMuted,
    textAlign: 'center',
  },
  menuDivider: {
    height:          1,
    backgroundColor: Colors.light.border,
    marginLeft:      PROFILE_MENU_DIVIDER_MARGIN,
  },
  avatarWrap: { position: 'relative' },
  avatarOverlay: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    borderRadius:    44,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarEditBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    backgroundColor: Colors.brand.primary,
    borderRadius:    12,
    width:           24,
    height:          24,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     '#fff',
  },
  planCard: { marginBottom: 0 },
  planCardInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  planLabel: { fontSize: 12, color: Colors.light.textMuted, marginBottom: 2 },
  planName:  { fontSize: 16, fontWeight: '700' },
  upgradeBtnFace: {
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  upgradeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
})
