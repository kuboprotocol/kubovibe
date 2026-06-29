/**
 * LandingSkeleton — minimal dark fallback with shimmer.
 * Zero external dependencies. Used while landing sections suspend or fail.
 */
export default function LandingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes kubo-shimmer {
          0% { background-position: -800px 0; }
          100% { background-position: 800px 0; }
        }
        .kubo-shimmer {
          background: linear-gradient(
            90deg,
            hsl(var(--muted) / 0.3) 0%,
            hsl(var(--muted) / 0.55) 50%,
            hsl(var(--muted) / 0.3) 100%
          );
          background-size: 800px 100%;
          animation: kubo-shimmer 1.6s ease-in-out infinite;
        }
      `}</style>
      <div className="max-w-4xl mx-auto px-6 py-24 space-y-6">
        <div className="kubo-shimmer h-10 w-2/3 mx-auto rounded-md" />
        <div className="kubo-shimmer h-6 w-1/2 mx-auto rounded-md" />
        <div className="kubo-shimmer h-32 w-full rounded-2xl mt-12" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          <div className="kubo-shimmer h-24 rounded-xl" />
          <div className="kubo-shimmer h-24 rounded-xl" />
          <div className="kubo-shimmer h-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
