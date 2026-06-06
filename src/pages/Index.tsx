import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import CommunitySection from "@/components/landing/CommunitySection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FAQSection from "@/components/landing/FAQSection";
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
                Junte-se a milhares de criadores que lançam apps todos os dias com KUBO VIBE.
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
...
        </div>
      </footer>
    </div>
  );
};

export default Index;
