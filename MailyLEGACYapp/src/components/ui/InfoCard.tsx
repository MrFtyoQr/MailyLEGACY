/**
 * InfoCard.tsx — tarjeta blanca limpia; el color vive solo en el IconBadge.
 */

import React from 'react'
import { type ViewStyle } from 'react-native'
import { Card } from './Card'

const WHITE_CARD = { face: '#FFFFFF', shadow: '#E8ECF0' }

interface InfoCardProps {
  children: React.ReactNode
  padding?: number
  style?:   ViewStyle
}

export function InfoCard({ children, padding = 16, style }: InfoCardProps) {
  return (
    <Card
      faceColor={WHITE_CARD.face}
      shadowColor={WHITE_CARD.shadow}
      padding={padding}
      style={style}
    >
      {children}
    </Card>
  )
}
