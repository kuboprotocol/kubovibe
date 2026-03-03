import Navbar from '@/components/landing/Navbar'
import HeroSection from '@/components/landing/HeroSection'
import CommunitySection from '@/components/landing/CommunitySection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import FAQSection from '@/components/landing/FAQSection'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const Index = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <CommunitySection />
      <HowItWorksSection />

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="py-24 px-6"
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 rounded-3xl gradient-primary shadow-glow-lg">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4">
              Ready to build something amazing?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
              Join thousands of creators who ship apps every day with idealane.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="bg-background text-foreground hover:bg-background/90 rounded-xl px-8 font-semibold gap-2"
            >
              Start building for free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.section>

      <FAQSection />

      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 idealane. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Index
