import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'What is KUBO VIBE?',
    a: 'KUBO VIBE is a platform that lets you create professional apps, websites, e-commerce stores, and tools using AI — no coding required.',
  },
  {
    q: 'Does it work for any type of business?',
    a: 'Yes! Whether you run a restaurant, consulting firm, e-commerce store, or anything else, KUBO VIBE adapts to your needs.',
  },
  {
    q: "What if I don't know exactly what I want?",
    a: 'No problem! Just describe your idea in a few words and our AI will suggest designs, layouts, and features to get you started.',
  },
  {
    q: 'Do I need technical knowledge?',
    a: 'Not at all. KUBO VIBE is designed to be used by anyone. Just describe what you want in plain language.',
  },
  {
    q: 'Can I edit what is created?',
    a: 'Absolutely! You can edit everything — text, images, colors, layout, pages — just by talking naturally to the AI.',
  },
  {
    q: 'What does the free plan include?',
    a: 'The free plan includes credits to generate and iterate on your projects, access to templates, and community sharing.',
  },
]

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-xs font-medium text-primary uppercase tracking-widest mb-3 block">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            Questions & answers
          </h2>
        </motion.div>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="border border-border rounded-xl overflow-hidden bg-card"
            >
              <button
                onClick={() => setOpen(open === index ? null : index)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-foreground text-sm">{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                    open === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {open === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
