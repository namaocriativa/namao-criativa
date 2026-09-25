import { motion } from 'motion/react'
import { clinic, copy } from '../data/clinic'
import { InstagramIcon } from './icons'

export function InstagramCta() {
  return (
    <section className="section instagram-cta" id="instagram">
      <div className="wrap instagram-cta__inner">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="kicker">{copy.instagramCta.kicker}</span>
          <h2 className="section-title">{copy.instagramCta.title}</h2>
          <p>{copy.instagramCta.text}</p>
          <motion.a
            className="btn btn--instagram"
            href={clinic.instagram}
            target="_blank"
            rel="noreferrer"
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <InstagramIcon />
            {copy.instagramCta.cta}
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
