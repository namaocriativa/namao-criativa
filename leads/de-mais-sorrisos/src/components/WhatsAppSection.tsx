import { motion } from 'motion/react'
import { copy } from '../data/clinic'
import { whatsappUrl } from '../lib/whatsapp'
import { WhatsAppIcon } from './icons'

export function WhatsAppSection() {
  return (
    <section className="section support" id="whatsapp">
      <div className="wrap">
        <motion.span
          className="kicker"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {copy.whatsapp.kicker}
        </motion.span>
        <motion.h2
          className="section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
        >
          {copy.whatsapp.title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.14 }}
        >
          {copy.whatsapp.text}
        </motion.p>
        <motion.a
          className="btn btn--whatsapp"
          href={whatsappUrl()}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <WhatsAppIcon />
          💬 {copy.whatsapp.cta}
        </motion.a>
      </div>
    </section>
  )
}
