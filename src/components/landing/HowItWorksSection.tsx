import { motion } from 'framer-motion'
import { Sparkles, MessageSquare, Rocket } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Sparkles,
    title: 'Describe your idea',
    description: 'Write a natural description of the app you want. Add colors, features, or upload references.',
    accent: 'from-primary/20 to-accent',
  },
  {
    number: '02',
    icon: MessageSquare,
    title: 'Iterate with AI',
    description: 'Chat with the AI to refine layouts, add pages, change styles — just like talking to a designer.',
    accent: 'from-blue-100/50 to-indigo-100/50',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Ship it',
    description: 'One click to publish. Get a shareable link, custom domain, or export the code.',
    accent: 'from-violet-100/50 to-purple-100/50',
  },
]

export default function HowItWorksSection() {
  return (
    <section className="py-24 px-6 relative">
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-medium text-primary uppercase tracking-widest mb-3 block">How it works</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            From idea to app in minutes
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            Three simple steps to go from concept to a fully working application.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                className="group relative"
              >
                <div className="p-6 rounded-2xl border border-border bg-card hover:shadow-glow-lg transition-all duration-300 h-full">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.accent} flex items-center justify-center mb-5`}>
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{step.number}</span>
                  <h3 className="text-lg font-display font-semibold text-foreground mt-1 mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
