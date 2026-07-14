import { useRef, useCallback, useEffect } from 'react'
import { Tldraw, Editor, getSnapshot, loadSnapshot } from 'tldraw'
import 'tldraw/tldraw.css'

interface TLDrawEditorProps {
  onSave?: (snapshot: any) => void
  onChange?: (snapshot: any) => void
  initialSnapshot?: any
  autoSaveDelay?: number
}

export default function TLDrawEditor({
  onSave,
  onChange,
  initialSnapshot,
  autoSaveDelay = 800,
}: TLDrawEditorProps) {
  const editorRef = useRef<Editor | null>(null)
  const debounceRef = useRef<number | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    ;(window as any).tldrawEditor = editor

    if (initialSnapshot) {
      try {
        loadSnapshot(editor.store, initialSnapshot)
      } catch (err) {
        console.error('[TLDraw] Failed to load snapshot:', err)
      }
    }

    // Auto-update preview on any user-driven document change (debounced)
    unsubRef.current = editor.store.listen(
      () => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => {
          if (!editorRef.current) return
          const snapshot = getSnapshot(editorRef.current.store)
          try {
            onChange?.(snapshot)
          } catch (err) {
            console.error('[TLDraw] onChange handler failed:', err)
          }
          // Dispatch global event so a preview iframe elsewhere can refresh
          try {
            window.dispatchEvent(
              new CustomEvent('kubo:canvas:updated', { detail: { snapshot } }),
            )
          } catch {}
        }, autoSaveDelay)
      },
      { source: 'user', scope: 'document' },
    )

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (onSave && editorRef.current) {
          const snapshot = getSnapshot(editorRef.current.store)
          onSave(snapshot)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSave, onChange, initialSnapshot, autoSaveDelay])

  // Cleanup subscription + timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      if (unsubRef.current) {
        try { unsubRef.current() } catch {}
      }
    }
  }, [])

  return (
    <div className="w-full h-full">
      <Tldraw onMount={handleMount} />
    </div>
  )
}
