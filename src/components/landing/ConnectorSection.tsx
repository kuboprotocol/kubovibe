import { motion } from "framer-motion";
import { Plug, ArrowRight, Zap, Database, CreditCard, Bot, Server, Globe, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const connectorCategories = [
  {
    title: "AI & Automation",
    icon: Bot,
    accent: "from-primary/20 to-accent",
    items: ["OpenAI", "Claude", "Gemini", "DeepSeek"],
  },
  {
    title: "Pagamentos",
    icon: CreditCard,
    accent: "from-blue-900/30 to-indigo-900/20",
    items: ["Stripe", "Mercado Pago", "PayPal", "Pix"],
  },
  {
    title: "Database",
    icon: Database,
    accent: "from-violet-900/30 to-purple-900/20",
    items: ["Supabase", "PostgreSQL", "Firebase", "MongoDB"],
  },
  {
    title: "Your API",
    icon: Code,
    accent: "from-emerald-900/30 to-teal-900/20",
    items: ["REST", "GraphQL", "Webhooks", "Proprietary APIs"],
  },
];

const ConnectorSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-medium text-primary uppercase tracking-widest mb-3 block">Unlimited Integrations</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            Connect any technology
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            AI, payments, databases, and external APIs integrated into your app in seconds.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {connectorCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="group relative h-full"
              >
                <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:shadow-gold transition-all duration-300 h-full flex flex-col hover:border-primary/30">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.accent} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-lg font-display font-semibold text-foreground mb-4">{category.title}</h3>
                  <ul className="space-y-3 flex-grow">
                    {category.items.map((item) => (
                      <li key={item} className="flex items-center text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mr-2" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center"
        >
          <Button
            size="lg"
            onClick={() => navigate("/builder")}
            className="gap-2 rounded-xl px-10 h-14 text-base font-semibold group shadow-lg hover:shadow-primary/20 transition-all"
          >
            <Plug className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            Add connector to my app
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default ConnectorSection;