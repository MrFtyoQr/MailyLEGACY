/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#00C5E3',
          warm:    '#F97316',
          hot:     '#E91E8C',
          cool:    '#2196F3',
          nature:  '#00BFA5',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted:   '#F8FAFC',
          card:    '#FFFFFF',
        },
        dark: {
          bg:      '#0A0F1E',
          surface: '#131B2E',
          card:    '#1E2A40',
          border:  '#2D3F5C',
        },
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        medium: ['Inter_500Medium', 'System'],
        semibold: ['Inter_600SemiBold', 'System'],
        bold: ['Inter_700Bold', 'System'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
}
