import { motion } from 'framer-motion'

const projects = [
  { name: 'Void Studio Landing Page', color: 'from-primary/20 to-accent' },
  { name: 'Ember & Oak Whiskey Landing', color: 'from-amber-100 to-orange-50' },
  { name: 'Fintech Pitch Deck', color: 'from-blue-50 to-indigo-50' },
  { name: 'IdeaChat - AI Chatbot', color: 'from-primary/10 to-primary/5' },
  { name: 'Cloud SaaS Landing Page', color: 'from-violet-50 to-blue-50' },
  { name: 'MedConnect API Docs', color: 'from-cyan-50 to-teal-50' },
  { name: 'Calorie Tracker App', color: 'from-lime-50 to-green-50' },
  { name: 'Bali Exclusive Villas', color: 'from-amber-50 to-yellow-50' },
]

export default function CommunitySection() {
  const doubled = [...projects, ...projects]

  return (
    <section className="py-20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-10">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-bold text-foreground text-center"
        >
          Made by creators like you
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center mt-3"
        >
          Discover community projects, open their live versions, or clone them to keep iterating.
        </motion.p>
      </div>

      <div className="relative">
        <div className="flex gap-5 animate-scroll-left w-max">
          {doubled.map((project, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
            >
              <div className={`h-40 bg-gradient-to-br ${project.color} flex items-center justify-center`}>
                <div className="w-48 h-28 bg-background/60 rounded-lg shadow-sm" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
              </div>
            </div>
          ))}
        </div>
        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </section>
  )
}
