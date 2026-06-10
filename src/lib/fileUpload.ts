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
  originalSize: number
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

const COMPRESS_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const COMPRESS_MAX_WIDTH = 1920
const COMPRESS_QUALITY = 0.8

async function compressImage(file: File): Promise<File> {
  if (!COMPRESS_TYPES.includes(file.type)) return file
  // Skip small images (< 200KB)
  if (file.size < 200 * 1024) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > COMPRESS_MAX_WIDTH) {
        height = Math.round((height * COMPRESS_MAX_WIDTH) / width)
        width = COMPRESS_MAX_WIDTH
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const outputType = file.type === 'image/png' ? 'image/webp' : file.type
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const ext = outputType === 'image/webp' ? '.webp' : file.name.substring(file.name.lastIndexOf('.'))
            const name = file.name.replace(/\.[^.]+$/, ext)
            resolve(new File([blob], name, { type: outputType }))
          } else {
            resolve(file) // Keep original if compressed is larger
          }
        },
        outputType,
        COMPRESS_QUALITY
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export async function uploadFile(
  file: File,
  userId: string,
  onProgress?: (percent: number) => void
): Promise<UploadedFile> {
  const error = validateFile(file)
  if (error) throw new Error(error)

  onProgress?.(5)

  // Compress images before upload
  const processedFile = await compressImage(file)

  onProgress?.(15)

  const safeName = sanitizeFileName(processedFile.name)
  const timestamp = Date.now()
  const path = `${userId}/${timestamp}_${safeName}`

  console.log(`[uploadFile] Inciando upload para path: ${path}`, { contentType: processedFile.type });
  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(path, processedFile, {
      contentType: processedFile.type,
      upsert: false,
    })

  if (uploadError) {
    console.error(`[uploadFile] Erro no upload:`, uploadError);
    throw new Error(`Upload falhou: ${uploadError.message}`)
  }
  console.log(`[uploadFile] Upload concluído com sucesso para: ${path}`);

  onProgress?.(90)

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(path)

  onProgress?.(100)

  return {
    url: urlData.publicUrl,
    name: file.name,
    size: processedFile.size,
    originalSize: file.size,
    mimeType: processedFile.type,
    category: getFileCategory(file.type),
    path,
  }
}
