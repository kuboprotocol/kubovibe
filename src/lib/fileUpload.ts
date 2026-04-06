import { supabase } from '@/integrations/supabase/client'

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/vnd.rar'],
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'unknown'

export interface UploadedFile {
  url: string
  name: string
  size: number
  mimeType: string
  category: FileCategory
  path: string
}

export function getFileCategory(mimeType: string): FileCategory {
  for (const [cat, types] of Object.entries(ALLOWED_TYPES)) {
    if (types.includes(mimeType)) return cat as FileCategory
  }
  return 'unknown'
}

export function getAllAllowedTypes(): string[] {
  return Object.values(ALLOWED_TYPES).flat()
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100)
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `Arquivo muito grande (máx. ${MAX_FILE_SIZE / 1024 / 1024}MB)`
  }
  const allAllowed = getAllAllowedTypes()
  if (!allAllowed.includes(file.type)) {
    return `Tipo de arquivo não suportado: ${file.type || 'desconhecido'}`
  }
  return null
}

export async function uploadFile(
  file: File,
  userId: string,
  onProgress?: (percent: number) => void
): Promise<UploadedFile> {
  const error = validateFile(file)
  if (error) throw new Error(error)

  const safeName = sanitizeFileName(file.name)
  const timestamp = Date.now()
  const path = `${userId}/${timestamp}_${safeName}`

  onProgress?.(10)

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`)

  onProgress?.(90)

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(path)

  onProgress?.(100)

  return {
    url: urlData.publicUrl,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    category: getFileCategory(file.type),
    path,
  }
}
