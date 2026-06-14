import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import logoImg from '@/assets/logo-kubovibe-3d.png'

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logoImg} alt="KUBO VIBE" className="h-7" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: March 9, 2026</p>

        <div className="space-y-10 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using KUBO VIBE ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Platform. KUBO VIBE reserves the right to update these terms at any time, and continued use constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">
              KUBO VIBE is an AI-powered application builder that allows users to create web applications, games, metaverse experiences, and other digital products through natural language prompts. The Platform generates HTML, CSS, and JavaScript code based on user descriptions and provides tools for editing, previewing, and exporting projects.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">3. User Accounts</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 13 years old to use the Platform.</li>
              <li>One person may not maintain more than one free account.</li>
              <li>KUBO VIBE reserves the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">4. Intellectual Property</h2>
            <p className="text-muted-foreground mb-3">
              All code generated through the Platform belongs to you. You retain full ownership and rights to use, modify, distribute, and commercialize any applications created using KUBO VIBE.
            </p>
            <p className="text-muted-foreground">
              The KUBO VIBE brand, logo, design, and underlying technology are the exclusive property of KUBO PROTOCOL and are protected by intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">5. Acceptable Use</h2>
            <p className="text-muted-foreground mb-3">You agree not to use the Platform to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Create applications that are illegal, harmful, or promote violence.</li>
              <li>Generate content that infringes on third-party intellectual property rights.</li>
              <li>Attempt to reverse-engineer, decompile, or hack the Platform.</li>
              <li>Use automated scripts or bots to access the Platform excessively.</li>
              <li>Create applications designed for phishing, scamming, or fraud.</li>
              <li>Distribute malware, viruses, or other harmful code through generated applications.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">6. AI-Generated Content</h2>
            <p className="text-muted-foreground">
              The Platform uses artificial intelligence to generate code. While we strive for accuracy and quality, AI-generated content may contain errors, bugs, or security vulnerabilities. You are responsible for reviewing, testing, and validating all generated code before deploying it in production environments. KUBO VIBE is not liable for any damages resulting from the use of AI-generated code.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">7. Service Availability</h2>
            <p className="text-muted-foreground">
              KUBO VIBE aims to provide reliable service but does not guarantee 100% uptime. The Platform may be temporarily unavailable due to maintenance, updates, or unforeseen technical issues. We will make reasonable efforts to notify users of planned downtime in advance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">8. Data & Privacy</h2>
            <p className="text-muted-foreground">
              Your privacy is important to us. We collect and process personal data in accordance with our Privacy Policy. By using the Platform, you consent to the collection and use of your data as described therein. Project data, including generated code and chat history, is stored securely and is accessible only to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, KUBO VIBE and KUBO PROTOCOL shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities, arising from your use of the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">10. Termination</h2>
            <p className="text-muted-foreground">
              KUBO VIBE may terminate or suspend your access to the Platform at any time, with or without cause, with or without notice. Upon termination, your right to use the Platform ceases immediately, though you retain ownership of any previously generated and exported code.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">11. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms of Service, please reach out to us via our official channels at{' '}
              <a href="https://x.com/KUBOPROTOCOL" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                @KUBOPROTOCOL
              </a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center space-y-1">
          <p className="text-xs text-muted-foreground">A product by KUBO PROTOCOL · CNPJ: 65.822.139/0001-66</p>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} KUBO PROTOCOL. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}