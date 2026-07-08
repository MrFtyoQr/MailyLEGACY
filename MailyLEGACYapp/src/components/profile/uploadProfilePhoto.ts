/**
 * uploadProfilePhoto — sube foto de perfil vía multipart al endpoint del rol.
 */

import { API_URL } from '@constants/config'
import { getAccessToken } from '@lib/auth/session'

export async function uploadProfilePhoto(
  endpoint: string,
  asset: { uri: string; mimeType?: string | null },
): Promise<string> {
  const token = await getAccessToken()
  const form  = new FormData()
  form.append('photo', {
    uri:  asset.uri,
    name: 'profile.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob)

  const res = await fetch(`${API_URL}${endpoint}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  })
  if (!res.ok) throw new Error('Upload failed')

  const data = await res.json() as { photo_url: string }
  return data.photo_url
}
