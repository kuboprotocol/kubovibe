import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import CommunitySection from "@/components/landing/CommunitySection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FAQSection from "@/components/landing/FAQSection";
import DomainSection from "@/components/landing/DomainSection";
import ConnectorSection from "@/components/landing/ConnectorSection";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />

        {/* Gold divider */}
        <div className="max-w-xl mx-auto gold-line" aria-hidden="true" />

        <CommunitySection />
        <HowItWorksSection />

        {/* Gold divider */}
        <div className="max-w-xl mx-auto gold-line" aria-hidden="true" />

        {/* Conectores — instiga a ligar APIs e serviços */}
        <ConnectorSection />

        {/* Gold divider */}
        <div className="max-w-xl mx-auto gold-line" aria-hidden="true" />

        {/* Domínio — instiga comprar ou transferir via Ionos */}
        <DomainSection />

        {/* Gold divider */}
        <div className="max-w-xl mx-auto gold-line" aria-hidden="true" />

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-24 px-6"
        >
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-12 rounded-3xl gradient-primary shadow-gold relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              <h1 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4 relative z-10">
                Pronto para construir algo incrível?
              </h1>
              <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto relative z-10">
                Junte-se a milhares de criadores que lançam apps todos os dias
                com KUBO VIBE.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/builder")}
                className="bg-background text-foreground hover:bg-background/90 rounded-xl px-8 font-semibold gap-2 relative z-10"
              >
                Começar a construir grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.section>

        <FAQSection />
      </main>

      <footer className="py-16 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground tracking-wide">
                KUBO VIBE
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                A product by KUBO PROTOCOL
                <br />
                CNPJ: 65.822.139/0001-66
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <a
                href="/privacy"
                className="hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="hover:text-foreground transition-colors"
              >
                Terms of Service
              </a>
              <a
                href="https://x.com/KUBOPROTOCOL"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Twitter
              </a>
              <a
                href="https://t.me/+WoYG4tMTuJY5ZjNh"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Telegram
              </a>
              <a
                href="https://github.com/kuboprotocol/kubovibe"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} KUBO PROTOCOL. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;