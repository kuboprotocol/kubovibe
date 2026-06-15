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
    animation: 'kubo-orbit 9s linear infinite',
  }

  const cubeWrapStyle: CSSProperties = {
    width: cube,
    height: cube,
    transformStyle: 'preserve-3d',
    animation: 'kubo-spin 4s linear infinite',
    transform: `translate(-50%, -50%)`,
  }

  const faceBase: CSSProperties = {
    position: 'absolute',
    width: cube,
    height: cube,
    background:
      'linear-gradient(135deg, hsl(43 78% 62%) 0%, hsl(43 70% 45%) 40%, hsl(38 65% 30%) 100%)',
    border: '1px solid hsl(43 80% 70% / 0.6)',
    boxShadow: 'inset 0 0 12px hsl(43 90% 80% / 0.45), 0 0 16px hsl(43 80% 50% / 0.35)',
    backfaceVisibility: 'hidden',
  }

  const half = cube / 2

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
      `}</style>

      <span
        className="font-display font-bold tracking-[0.18em] text-foreground select-none whitespace-nowrap"
        style={{ fontSize: size, lineHeight: 1 }}
      >
        KUBO&nbsp;VIBE
      </span>

      {/* Orbiting cube layer (visually in front, sized to span the wordmark) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
        <div style={orbitStyle} className="relative">
          {/* cube positioned at the orbit edge */}
          <div className="absolute top-1/2 left-full" style={cubeWrapStyle}>
            <div style={{ ...faceBase, transform: `translateZ(${half}px)` }} />
            <div style={{ ...faceBase, transform: `rotateY(180deg) translateZ(${half}px)` }} />
            <div style={{ ...faceBase, transform: `rotateY(90deg) translateZ(${half}px)` }} />
            <div style={{ ...faceBase, transform: `rotateY(-90deg) translateZ(${half}px)` }} />
            <div style={{ ...faceBase, transform: `rotateX(90deg) translateZ(${half}px)` }} />
            <div style={{ ...faceBase, transform: `rotateX(-90deg) translateZ(${half}px)` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
