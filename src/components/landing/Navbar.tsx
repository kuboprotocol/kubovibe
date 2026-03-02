import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const navigate = useNavigate()

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-foreground tracking-tight">
          idealane
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <Button variant="nav" size="sm" onClick={() => navigate('/')}>
            Home
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/pricing')}>
            Pricing
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/support')}>
            Support
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
          Sign in
        </Button>
      </div>
    </nav>
  )
}
