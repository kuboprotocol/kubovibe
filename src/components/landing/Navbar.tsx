import { APP_NAME } from '@/config/brand'
import AnimatedLogo from '@/components/branding/AnimatedLogo'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const navigate = useNavigate()

  return (
    <nav className="sticky top-0 z-50 glass glass-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" aria-label={APP_NAME} className="flex items-center gap-3 group">
          <AnimatedLogo size={18} className="group-hover:scale-105 transition-transform" />
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {['Home', 'Download', 'Pricing', 'Docs', 'Shortlinks', 'Support'].map((item) => (
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
