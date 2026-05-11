export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const

export const Radii = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 9999,
} as const

export const Shadows = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  3,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius:  8,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius:  16,
    elevation:     8,
  },
} as const

export const TAB_BAR_HEIGHT = 64
export const HEADER_HEIGHT  = 56
