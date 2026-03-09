import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import logoImg from '@/assets/logo-kubovibe.png'

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: March 9, 2026</p>

        <div className="space-y-10 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">1. Introduction</h2>
            <p className="text-muted-foreground">
              KUBO VIBE, operated by KUBO PROTOCOL ("we", "us", "our"), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and share your personal information when you use our AI-powered application builder platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">2.1 Account Information</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Email address</li>
              <li>Display name</li>
              <li>Profile picture (optional)</li>
              <li>Authentication credentials (securely hashed)</li>
            </ul>
            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">2.2 Usage Data</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Prompts and messages sent to the AI builder</li>
              <li>Generated code and project data</li>
              <li>Feature usage patterns and interaction logs</li>
              <li>Device information and browser type</li>
            </ul>
            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">2.3 Automatically Collected Data</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>Referring URLs and page views</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>To provide, maintain, and improve the Platform</li>
              <li>To process your prompts and generate code through AI models</li>
              <li>To save and sync your projects across sessions</li>
              <li>To send important service-related notifications</li>
              <li>To detect, prevent, and address security issues and abuse</li>
              <li>To analyze usage trends and improve user experience</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">4. AI Processing</h2>
            <p className="text-muted-foreground">
              When you use KUBO VIBE's builder, your prompts are sent to AI language models to generate code. These prompts may be processed by third-party AI providers. We do not use your prompts to train AI models. Your project data and generated code remain private and are not shared with other users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">5. Data Storage & Security</h2>
            <p className="text-muted-foreground">
              Your data is stored on secure servers with industry-standard encryption. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Project data is encrypted at rest and in transit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">6. Data Sharing</h2>
            <p className="text-muted-foreground mb-3">We do not sell your personal data. We may share your information only in the following circumstances:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Service Providers:</strong> Third-party services that help us operate the Platform (hosting, AI processing, analytics).</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority.</li>
              <li><strong>Safety:</strong> To protect the rights, property, or safety of KUBO VIBE, our users, or the public.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">7. Cookies</h2>
            <p className="text-muted-foreground">
              We use essential cookies to maintain your session and preferences. We may also use analytics cookies to understand how users interact with the Platform. You can control cookie settings through your browser preferences, though disabling essential cookies may affect functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">8. Your Rights</h2>
            <p className="text-muted-foreground mb-3">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Export your data in a portable format</li>
              <li>Object to or restrict certain processing activities</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">9. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your personal data for as long as your account is active or as needed to provide services. Project data is kept until you delete it or your account. Upon account deletion, we will remove your personal data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">10. Children's Privacy</h2>
            <p className="text-muted-foreground">
              KUBO VIBE is not intended for children under 13 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child under 13, we will take steps to delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on the Platform or sending an email. Your continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at{' '}
              <a href="https://x.com/KUBOPROTOCOL" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                @KUBOPROTOCOL
              </a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
          © 2026 KUBO VIBE. All rights reserved.
        </div>
      </footer>
    </div>
  )
}