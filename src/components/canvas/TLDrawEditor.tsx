import { useRef, useCallback } from 'react'
import { Tldraw, Editor, getSnapshot, loadSnapshot } from 'tldraw'
import 'tldraw/tldraw.css'

interface TLDrawEditorProps {
  onSave?: (snapshot: any) => void
  initialSnapshot?: any
}

export default function TLDrawEditor({ onSave, initialSnapshot }: TLDrawEditorProps) {
  const editorRef = useRef<Editor | null>(null)

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
  }, [onSave, initialSnapshot])

  return (
    <div className="w-full h-full">
      <Tldraw onMount={handleMount} />
    </div>
  )
}
