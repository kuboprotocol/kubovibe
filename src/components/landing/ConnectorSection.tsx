import { motion } from "framer-motion";
import { Brain, CreditCard, Database, Terminal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ConnectorSection = () => {
  const navigate = useNavigate();

  const categories = [
    {
      title: "Inteligência Artificial",
      description: "OpenAI, Anthropic, Google Gemini e modelos open source.",
      icon: Brain,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      title: "Pagamentos",
      description: "Stripe, PayPal, Mercado Pago e soluções bancárias.",
      icon: CreditCard,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Banco de dados",
      description: "Supabase, Firebase, PostgreSQL e MongoDB.",
      icon: Database,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      title: "Sua API",
      description: "Conecte qualquer endpoint REST ou GraphQL personalizado.",
      icon: Terminal,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Conectores do Ecossistema
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Integre as melhores ferramentas e serviços diretamente no seu aplicativo com poucos cliques.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {categories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors"
            >
              <div className={`h-10 w-10 rounded-xl ${category.bg} flex items-center justify-center mb-4`}>
                <category.icon className={`h-5 w-5 ${category.color}`} />
              </div>
              <h3 className="font-bold mb-2">{category.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {category.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/builder")}
            className="rounded-xl px-8 font-semibold gap-2 gradient-primary text-primary-foreground border-0"
          >
            <Plus className="h-4 w-4" />
            Adicionar conector ao meu app
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ConnectorSection;