import { motion } from "framer-motion";
import { Globe, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const DomainSection = () => {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Dê um nome ao seu projeto
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha o endereço perfeito para o seu novo aplicativo.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl border border-border bg-card/50 backdrop-blur-sm hover:shadow-gold transition-all duration-300 group"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">Comprar domínio novo</h3>
            <p className="text-muted-foreground mb-8">
              Encontre o domínio ideal com os melhores preços do mercado.
            </p>
            <Button 
              className="w-full rounded-xl gap-2"
              onClick={() => window.open("https://www.ionos.com/domains/domain-names", "_blank")}
            >
              Verificar disponibilidade
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl border border-border bg-card/50 backdrop-blur-sm hover:shadow-gold transition-all duration-300 group"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3">Transferir domínio existente</h3>
            <p className="text-muted-foreground mb-8">
              Traga seu domínio para a Ionos e centralize sua gestão.
            </p>
            <Button 
              variant="outline" 
              className="w-full rounded-xl gap-2"
              onClick={() => window.open("https://www.ionos.com/domains/domain-transfer", "_blank")}
            >
              Iniciar transferência
            </Button>
          </motion.div>
        </div>

        <p className="text-center mt-12 text-xs text-muted-foreground italic">
          * Serviços de domínio fornecidos em parceria com a IONOS.
        </p>
      </div>
    </section>
  );
};

export default DomainSection;