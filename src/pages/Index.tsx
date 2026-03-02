import Navbar from '@/components/landing/Navbar'
import HeroSection from '@/components/landing/HeroSection'
import CommunitySection from '@/components/landing/CommunitySection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import FAQSection from '@/components/landing/FAQSection'

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <CommunitySection />
      <HowItWorksSection />
      <FAQSection />
      <footer className="py-10 px-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          © 2026 idealane. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default Index
