import { motion } from 'motion/react'
import { copy } from '../data/profile'
import { whatsappUrl } from '../lib/whatsapp'
import { ChatIcon, ClockIcon, VideoIcon, WhatsAppIcon } from './icons'
import { Reveal } from './Reveal'

const icons = [ChatIcon, VideoIcon, ClockIcon]

export function HowItWorks() {
  return (
    <section className="section how" id="como-funciona">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="kicker">{copy.how.kicker}</span>
          <h2 className="section-title">{copy.how.title}</h2>
        </Reveal>

        <ol className="steps">
          {copy.how.steps.map((step, index) => {
            const Icon = icons[index]
            return (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.55, delay: index * 0.1 }}
              >
                <span className="steps__icon">
                  <Icon />
                </span>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </motion.li>
            )
          })}
        </ol>

        <Reveal delay={0.12}>
          <motion.a
            className="btn btn--primary"
            href={whatsappUrl()}
            target="_blank"
            rel="noreferrer"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <WhatsAppIcon />
            {copy.how.cta}
          </motion.a>
        </Reveal>
      </div>
    </section>
  )
}
