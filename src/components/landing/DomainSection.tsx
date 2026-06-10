import { motion } from "framer-motion";
import { Globe, ArrowRight, RefreshCw, ShoppingCart } from "lucide-react";
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
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-24 px-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Eyebrow */}
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Seu app merece um endereço de verdade
        </p>

        {/* Heading */}
        <h2 className="text-center text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
          Publique com domínio próprio
        </h2>
        <p className="text-center text-muted-foreground max-w-xl mx-auto mb-12">
          Um app sem domínio é uma ideia sem endereço. Registre ou transfira o
          seu em segundos — direto pela Ionos, nosso parceiro de hospedagem.
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buy domain */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-4 hover:border-primary/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg mb-1">
                Comprar um domínio novo
              </h3>
              <p className="text-sm text-muted-foreground">
                Pesquise a disponibilidade e registre o domínio perfeito para o
                seu projeto — .com, .app, .io e muito mais.
              </p>
            </div>
            <Button
              onClick={handleBuyDomain}
              className="mt-auto gap-2 rounded-xl"
            >
              Buscar domínio
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Transfer domain */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-4 hover:border-primary/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg mb-1">
                Transferir domínio existente
              </h3>
              <p className="text-sm text-muted-foreground">
                Já tem um domínio em outro provedor? Traga ele para a Ionos e
                conecte ao seu app KUBO VIBE sem complicação.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleTransferDomain}
              className="mt-auto gap-2 rounded-xl"
            >
              Transferir domínio
              <Globe className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Fine print */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Parceria com{" "}
          <a
            href="https://www.ionos.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            Ionos
          </a>{" "}
          · Você será redirecionado para o site da Ionos para concluir a compra.
        </p>
      </div>
    </motion.section>
  );
};

export default DomainSection;