import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

export default function Navbar() {
  const navigate = useNavigate()

  return (
    <nav className="sticky top-0 z-50 glass glass-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-display font-bold text-foreground tracking-tight">
            KUBO VIBE
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-muted-foreground font-medium" onClick={() => navigate('/')}>
            Home
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground font-medium" onClick={() => navigate('/pricing')}>
            Pricing
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground font-medium" onClick={() => navigate('/support')}>
            Support
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground font-medium" onClick={() => navigate('/builder')}>
            Log in
          </Button>
          <Button variant="hero" size="sm" onClick={() => navigate('/builder')} className="rounded-xl">
            Get started
          </Button>
        </div>
      </div>
    </nav>
  )
}
