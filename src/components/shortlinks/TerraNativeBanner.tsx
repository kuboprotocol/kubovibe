import { useEffect, useRef } from 'react'
import { TERRA_ADS_NATIVE_BANNER_ID, TERRA_ADS_NATIVE_BANNER_SRC } from '@/lib/terraAds'

export default function TerraNativeBanner() {
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.src = TERRA_ADS_NATIVE_BANNER_SRC
    containerRef.current?.appendChild(script)

    // Filtro cosmético: remove overlays externos de spam/conteúdo indesejado
    const observer = new MutationObserver(() => {
      document.querySelectorAll('body > iframe, body > div[id^="ad_"]').forEach((el) => {
        const isOurBanner = containerRef.current?.contains(el)
        const isOversized =
          el instanceof HTMLElement &&
          (el.offsetWidth >= window.innerWidth * 0.8 ||
            el.offsetHeight >= window.innerHeight * 0.8)
        if (!isOurBanner && isOversized) {
          el.remove()
        }
      })
    })
    observer.observe(document.body, { childList: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border">
      <div className="max-w-lg mx-auto px-4 py-2">
        <p className="text-[10px] text-muted-foreground text-center mb-1 uppercase tracking-wide">
          Publicidade · TERRA ADS
        </p>
        <div
          ref={containerRef}
          id={TERRA_ADS_NATIVE_BANNER_ID}
          className="min-h-[60px] flex items-center justify-center overflow-hidden rounded-lg"
        />
      </div>
    </div>
  )
}
