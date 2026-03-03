import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

const projects = [
  { name: 'Void Studio', desc: 'Creative agency landing', color: 'from-primary/20 to-accent' },
  { name: 'Ember & Oak', desc: 'E-commerce storefront', color: 'from-amber-100 to-orange-50' },
  { name: 'Fintech Pro', desc: 'Financial dashboard', color: 'from-blue-50 to-indigo-50' },
  { name: 'IdeaChat', desc: 'AI chatbot interface', color: 'from-primary/10 to-primary/5' },
  { name: 'CloudSync', desc: 'SaaS landing page', color: 'from-violet-50 to-blue-50' },
  { name: 'MedConnect', desc: 'Healthcare portal', color: 'from-cyan-50 to-teal-50' },
  { name: 'FitTrack', desc: 'Fitness tracker app', color: 'from-lime-50 to-green-50' },
  { name: 'TravelBali', desc: 'Travel booking site', color: 'from-amber-50 to-yellow-50' },
]

export default function CommunitySection() {
  const doubled = [...projects, ...projects]

  return (
    <section className="py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col items-center"
        >
          <span className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Showcase</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground text-center">
            Built by creators worldwide
          </h2>
          <p className="text-muted-foreground text-center mt-3 max-w-md">
            Explore what the community has built. Clone any project and make it yours.
          </p>
        </motion.div>
      </div>

      <div className="relative">
        <div className="flex gap-5 animate-scroll-left w-max">
          {doubled.map((project, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 rounded-2xl border border-border bg-card overflow-hidden hover:shadow-glow-lg transition-all duration-300 cursor-pointer group"
            >
              <div className={`h-40 bg-gradient-to-br ${project.color} flex items-center justify-center relative`}>
                <div className="w-48 h-28 bg-background/60 rounded-lg shadow-sm backdrop-blur-sm" />
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-1.5 rounded-lg bg-background/80 backdrop-blur-sm">
                    <ExternalLink className="h-3.5 w-3.5 text-foreground" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{project.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </section>
  )
}
