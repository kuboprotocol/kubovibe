import { CSSProperties } from 'react'

interface AnimatedLogoProps {
  size?: number // height in px for the text
  className?: string
}

/**
 * AnimatedLogo — "KUBO VIBE" with a 3D metallic gold cube orbiting the text,
 * spinning in 3D like a rotating planet. Pure CSS 3D, GPU-accelerated.
 */
export default function AnimatedLogo({ size = 32, className = '' }: AnimatedLogoProps) {
  const cube = size * 0.85
  const orbitRadius = size * 2.2

  const sceneStyle: CSSProperties = {
    height: size * 1.6,
    perspective: `${size * 12}px`,
  }

  const orbitStyle: CSSProperties = {
    width: orbitRadius * 2,
    height: orbitRadius * 2,
    transformStyle: 'preserve-3d',
    animation: 'kubo-orbit 24s ease-in-out infinite',
    willChange: 'transform',
  }

  const cubeWrapStyle: CSSProperties = {
    width: cube,
    height: cube,
    transformStyle: 'preserve-3d',
    animation: 'kubo-spin 12s ease-in-out infinite',
    transform: `translate(-50%, -50%)`,
    willChange: 'transform',
  }

  // Ultra-realistic gold face: layered specular highlight + radial sheen + metallic gradient
  const faceBase: CSSProperties = {
    position: 'absolute',
    width: cube,
    height: cube,
    background: [
      // top-left specular hot-spot
      'radial-gradient(circle at 25% 20%, hsl(48 100% 96% / 0.95) 0%, hsl(45 95% 80% / 0.45) 14%, transparent 38%)',
      // bottom-right ambient bounce
      'radial-gradient(circle at 80% 85%, hsl(38 90% 55% / 0.55) 0%, transparent 55%)',
      // diagonal metallic sheen band
      'linear-gradient(125deg, transparent 30%, hsl(48 100% 92% / 0.35) 45%, transparent 60%)',
      // base brushed gold gradient
      'linear-gradient(135deg, hsl(45 92% 72%) 0%, hsl(43 85% 55%) 35%, hsl(38 78% 38%) 70%, hsl(32 70% 24%) 100%)',
    ].join(', '),
    border: '1px solid hsl(45 95% 80% / 0.85)',
    boxShadow: [
      'inset 0 0 14px hsl(48 100% 92% / 0.55)',
      'inset 0 2px 6px hsl(50 100% 95% / 0.7)',
      'inset 0 -2px 8px hsl(28 80% 18% / 0.6)',
      '0 0 18px hsl(43 90% 55% / 0.55)',
      '0 0 38px hsl(43 95% 60% / 0.35)',
    ].join(', '),
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  }

  // Static sheen overlay (replaces animated glint for GPU safety)
  const glintStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(115deg, transparent 35%, hsl(0 0% 100% / 0.3) 50%, transparent 65%)',
    opacity: 0.3,
    mixBlendMode: 'screen',
    pointerEvents: 'none',
  }

  const half = cube / 2

  const faces: CSSProperties[] = [
    { transform: `translateZ(${half}px)` },
    { transform: `rotateY(180deg) translateZ(${half}px)` },
    { transform: `rotateY(90deg) translateZ(${half}px)` },
    { transform: `rotateY(-90deg) translateZ(${half}px)` },
    { transform: `rotateX(90deg) translateZ(${half}px)` },
    { transform: `rotateX(-90deg) translateZ(${half}px)` },
  ]

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={sceneStyle}>
      <style>{`
        @keyframes kubo-spin {
          0%   { transform: translate(-50%, -50%) rotateX(0deg) rotateY(0deg); }
          100% { transform: translate(-50%, -50%) rotateX(360deg) rotateY(360deg); }
        }
        @keyframes kubo-orbit {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes kubo-glint {
          0%   { background-position: 0% 0%; opacity: 0.6; }
          50%  { background-position: 100% 100%; opacity: 1; }
          100% { background-position: 0% 0%; opacity: 0.6; }
        }
        @keyframes kubo-halo {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.9;  transform: translate(-50%, -50%) scale(1.15); }
        }
      `}</style>

      <span
        className="font-display font-bold tracking-[0.18em] text-foreground select-none whitespace-nowrap"
        style={{ fontSize: size, lineHeight: 1 }}
      >
        KUBO&nbsp;VIBE
      </span>

      {/* Orbiting cube layer */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
        <div style={orbitStyle} className="relative">
          <div className="absolute top-1/2 left-full" style={cubeWrapStyle}>
            {/* glow halo behind the cube for ambient bloom */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: cube * 1.8,
                height: cube * 1.8,
                background:
                  'radial-gradient(circle, hsl(43 95% 60% / 0.55) 0%, hsl(43 90% 50% / 0.25) 35%, transparent 70%)',
                filter: 'blur(6px)',
                animation: 'kubo-halo 4s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />
            {faces.map((f, i) => (
              <div key={i} style={{ ...faceBase, ...f }}>
                <div style={glintStyle} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
