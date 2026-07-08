/**
 * ProfileAvatarHeader — cabecera de perfil unificada con avatar y badge de rol.
 */

import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { AppIcon } from '@components/ui/AppIcon'
import { profileStyles as styles } from './profileStyles'

type RoleBadgeVariant = 'warning' | 'info' | 'success'

interface ProfileAvatarHeaderProps {
  fullName:      string
  email?:        string | null
  photoUrl?:     string | null
  roleLabel:     string
  roleBadge:     RoleBadgeVariant
  avatarColor: string
  onPickPhoto?:  () => void
  photoLoading?: boolean
}

export function ProfileAvatarHeader({
  fullName,
  email,
  photoUrl,
  roleLabel,
  roleBadge,
  avatarColor,
  onPickPhoto,
  photoLoading = false,
}: ProfileAvatarHeaderProps) {
  const avatar = (
    <Avatar uri={photoUrl} name={fullName} size={88} bgColor={avatarColor} />
  )

  return (
    <View style={styles.profileHeader}>
      {onPickPhoto ? (
        <TouchableOpacity onPress={onPickPhoto} activeOpacity={0.8} disabled={photoLoading}>
          <View style={styles.avatarWrap}>
            {avatar}
            {photoLoading
              ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )
              : (
                <View style={styles.avatarEditBadge}>
                  <AppIcon name="camera" size={11} color="#fff" />
                </View>
              )}
          </View>
        </TouchableOpacity>
      ) : avatar}

      <Text style={styles.name}>{fullName}</Text>
      {email ? <Text style={styles.email}>{email}</Text> : null}
      <Badge label={roleLabel} variant={roleBadge} size="sm" />
    </View>
  )
}
