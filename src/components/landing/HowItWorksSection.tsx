import { motion } from 'framer-motion'
import { Palette, MessageSquare, Layers } from 'lucide-react'

const steps = [
  {
    number: 1,
    icon: Palette,
    title: 'Describe Your App and Customize Colors',
    description: 'Describe what you want to create and specify your preferred colors. Your app is generated instantly.',
  },
  {
    number: 2,
    icon: MessageSquare,
    title: 'Edit Everything by Talking Naturally',
    description: 'Just tell what to change — design, text, images, or colors — and it updates your app instantly.',
  },
  {
    number: 3,
    icon: Layers,
    title: 'Organize Your Pages and Sections',
    description: 'Add, remove, or reorder pages and sections. Create landing pages, dashboards, or complete apps.',
  },
]

export default function HowItWorksSection() {
  return (
    <section className="py-20 px-6 bg-secondary/50">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-foreground text-center mb-4"
        >
          How to Create Apps
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center mb-14 max-w-xl mx-auto"
        >
          Creating apps is simple, flexible, and entirely no-code. From idea to launch in just a few steps.
        </motion.p>

        <div className="space-y-8">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="flex gap-5 items-start"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-glow">
                  {step.number}
                </div>
                <div className="pt-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
