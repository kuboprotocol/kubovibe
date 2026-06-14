import { motion } from "framer-motion";
import { Globe, ArrowRight, RefreshCw, ShoppingCart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const DomainSection = () => {
  const handleBuyDomain = () => {
    window.open(
      "https://www.ionos.com/domains/domain-checker",
      "_blank",
      "noopener noreferrer"
    );
  };

  const handleTransferDomain = () => {
    window.open(
      "https://www.ionos.com/domains/domain-transfer",
      "_blank",
      "noopener noreferrer"
    );
  };

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
      
      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-medium text-primary uppercase tracking-widest mb-3 block">Professional Domains</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            Your professional domain in minutes
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Buy a new domain or transfer an existing one to connect your brand to the world.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Buy Domain */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5, scale: 1.01 }}
            transition={{ duration: 0.3 }}
            className="group relative"
          >
            <div className="p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:shadow-gold transition-all duration-300 h-full flex flex-col hover:border-primary/30">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShoppingCart className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-display font-semibold text-foreground mb-3">Buy a new domain</h3>
              <p className="text-muted-foreground leading-relaxed mb-8 flex-grow">
                Find and register the ideal domain for your company, startup, or digital project.
              </p>
              <Button 
                onClick={handleBuyDomain}
                className="w-full sm:w-auto gap-2 rounded-xl group/btn"
              >
                Check availability
                <Search className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
              </Button>
            </div>
          </motion.div>

          {/* Card 2: Transfer Domain */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5, scale: 1.01 }}
            transition={{ duration: 0.3 }}
            className="group relative"
          >
            <div className="p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:shadow-gold transition-all duration-300 h-full flex flex-col hover:border-primary/30">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900/30 to-indigo-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <RefreshCw className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-display font-semibold text-foreground mb-3">Transfer existing domain</h3>
              <p className="text-muted-foreground leading-relaxed mb-8 flex-grow">
                Already have a domain? Transfer it easily and centralize everything in one place.
              </p>
              <Button 
                variant="outline"
                onClick={handleTransferDomain}
                className="w-full sm:w-auto gap-2 rounded-xl border-primary/20 hover:bg-primary/5 group/btn"
              >
                Transfer domain
                <Globe className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-12"
        >
          Service powered by the partner infrastructure of{" "}
          <a
            href="https://www.ionos.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors font-medium"
          >
            Ionos
          </a>.
        </motion.p>
      </div>
    </section>
  );
};

export default DomainSection;