import { motion } from "framer-motion";
import { Plug, ArrowRight, Zap, Database, CreditCard, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const connectors = [
  {
    icon: <Bot className="h-5 w-5" />,
    label: "IA & Automação",
    description: "OpenAI, Anthropic, Make, Zapier",
  },
  {
    icon: <CreditCard className="h-5 w-5" />,
    label: "Pagamentos",
    description: "Stripe, Mercado Pago, PagSeguro",
  },
  {
    icon: <Database className="h-5 w-5" />,
    label: "Banco de dados",
    description: "Supabase, Firebase, Airtable",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    label: "Sua própria API",
    description: "Qualquer endpoint REST ou GraphQL",
  },
];

const ConnectorSection = () => {
  const navigate = useNavigate();

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-24 px-6 bg-muted/30"
    >
      <div className="max-w-4xl mx-auto">
        {/* Eyebrow */}
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Conectores e integrações
        </p>

        {/* Heading */}
        <h2 className="text-center text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
          Seu app, seus dados, suas regras
        </h2>
        <p className="text-center text-muted-foreground max-w-xl mx-auto mb-12">
          Conecte qualquer serviço ao seu app em poucos cliques — sem escrever
          uma linha de código de integração.
        </p>

        {/* Connector grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {connectors.map((c) => (
            <div
              key={c.label}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 hover:border-primary/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                {c.icon}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm mb-0.5">
                  {c.label}
                </p>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/builder")}
            className="gap-2 rounded-xl px-8"
          >
            <Plug className="h-4 w-4" />
            Adicionar conector ao meu app
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.section>
  );
};

export default ConnectorSection;