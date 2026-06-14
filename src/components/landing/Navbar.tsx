import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import logoImg from '@/assets/logo-kubovibe-3d.png'

export default function Navbar() {
  const navigate = useNavigate()

  return (
    <nav className="sticky top-0 z-50 glass glass-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img src={logoImg} alt="KUBO VIBE" className="h-8 group-hover:scale-105 transition-transform" />
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {['Home', 'Pricing', 'Docs', 'Shortlinks', 'Support'].map((item) => (
            <Button
              key={item}
              variant="ghost"
              size="sm"
              className="text-muted-foreground font-medium rounded-xl hover:text-foreground hover:bg-secondary/80 transition-all"
              onClick={() => navigate(item === 'Home' ? '/' : `/${item.toLowerCase()}`)}
            >
              {item}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground font-medium rounded-xl hover:text-foreground"
            onClick={() => navigate('/auth')}
          >
            Log in
          </Button>
          <Button
            variant="hero"
            size="sm"
            onClick={() => navigate('/auth')}
            className="rounded-xl px-5"
          >
            Get started
          </Button>
        </div>
      </div>
    </nav>
  )
}
