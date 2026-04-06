import { FileText, Download, Music, Film, Image as ImageIcon, Archive } from 'lucide-react'
import type { UploadedFile, FileCategory } from '@/lib/fileUpload'

const categoryIcons: Record<FileCategory, typeof FileText> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  archive: Archive,
  unknown: FileText,
}

interface FilePreviewProps {
  file: UploadedFile
  compact?: boolean
}

export default function FilePreview({ file, compact }: FilePreviewProps) {
  const Icon = categoryIcons[file.category]

  if (compact) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
      >
        <Icon className="h-3 w-3" />
        <span className="max-w-[120px] truncate">{file.name}</span>
      </a>
    )
  }

  switch (file.category) {
    case 'image':
      return (
        <div className="rounded-xl overflow-hidden border border-border/50 max-w-xs">
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-auto max-h-48 object-cover"
            loading="lazy"
          />
          <div className="px-2 py-1 text-[10px] text-muted-foreground truncate bg-secondary/50">
            {file.name}
          </div>
        </div>
      )

    case 'video':
      return (
        <div className="rounded-xl overflow-hidden border border-border/50 max-w-xs">
          <video
            src={file.url}
            controls
            className="w-full max-h-48"
            preload="metadata"
          />
          <div className="px-2 py-1 text-[10px] text-muted-foreground truncate bg-secondary/50">
            {file.name}
          </div>
        </div>
      )

    case 'audio':
      return (
        <div className="rounded-xl border border-border/50 p-3 max-w-xs bg-secondary/30">
          <div className="flex items-center gap-2 mb-2">
            <Music className="h-4 w-4 text-primary" />
            <span className="text-xs truncate">{file.name}</span>
          </div>
          <audio src={file.url} controls className="w-full h-8" preload="metadata" />
        </div>
      )

    case 'document':
      if (file.mimeType === 'application/pdf') {
        return (
          <div className="rounded-xl overflow-hidden border border-border/50 max-w-xs">
            <iframe
              src={file.url}
              className="w-full h-48"
              title={file.name}
            />
            <div className="px-2 py-1 text-[10px] text-muted-foreground truncate bg-secondary/50 flex items-center justify-between">
              <span>{file.name}</span>
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                <Download className="h-3 w-3" />
              </a>
            </div>
          </div>
        )
      }
      return <DownloadCard file={file} />

    default:
      return <DownloadCard file={file} />
  }
}

function DownloadCard({ file }: { file: UploadedFile }) {
  const Icon = categoryIcons[file.category]
  const sizeLabel = file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(0)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-border/50 p-3 max-w-xs bg-secondary/30 hover:bg-secondary/50 transition-colors"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{sizeLabel}</p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground" />
    </a>
  )
}
