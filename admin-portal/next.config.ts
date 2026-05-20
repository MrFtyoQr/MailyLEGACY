import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Clerk recomendado para evitar advertencias
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

export default nextConfig
