import { useState } from 'react'
import { FileText, Download, Music, Film, Image as ImageIcon, Archive, X, ZoomIn, ZoomOut } from 'lucide-react'
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

function ImageLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)

  const zoomIn = () => setScale(s => Math.min(s + 0.5, 5))
  const zoomOut = () => setScale(s => Math.max(s - 0.5, 0.5))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button onClick={(e) => { e.stopPropagation(); zoomOut() }} className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground transition-colors">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
        <button onClick={(e) => { e.stopPropagation(); zoomIn() }} className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground transition-colors">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={onClose} className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground transition-colors ml-2">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className="overflow-auto max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={name}
          className="transition-transform duration-200 ease-out"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
          onWheel={(e) => {
            e.preventDefault()
            if (e.deltaY < 0) zoomIn()
            else zoomOut()
          }}
        />
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-secondary/80 px-3 py-1.5 rounded-lg">
        {name}
      </div>
    </div>
  )
}

export default function FilePreview({ file, compact }: FilePreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const Icon = categoryIcons[file.category]

  if (compact) {
    return (
      <>
        {file.category === 'image' ? (
          <button
            onClick={() => setLightboxOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
          >
            <Icon className="h-3 w-3" />
            <span className="max-w-[120px] truncate">{file.name}</span>
          </button>
        ) : (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
          >
            <Icon className="h-3 w-3" />
            <span className="max-w-[120px] truncate">{file.name}</span>
          </a>
        )}
        {lightboxOpen && <ImageLightbox url={file.url} name={file.name} onClose={() => setLightboxOpen(false)} />}
      </>
    )
  }

  switch (file.category) {
    case 'image':
      return (
        <>
          <div
            className="rounded-xl overflow-hidden border border-border/50 max-w-xs cursor-pointer group"
            onClick={() => setLightboxOpen(true)}
          >
            <div className="relative">
              <img
                src={file.url}
                alt={file.name}
                className="w-full h-auto max-h-48 object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="px-2 py-1 text-[10px] text-muted-foreground truncate bg-secondary/50">
              {file.name}
            </div>
          </div>
          {lightboxOpen && <ImageLightbox url={file.url} name={file.name} onClose={() => setLightboxOpen(false)} />}
        </>
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
