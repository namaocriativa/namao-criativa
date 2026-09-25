import { motion } from 'motion/react'
import { copy, profile } from '../data/profile'
import { InstagramIcon } from './icons'

export function InstagramCta() {
  return (
    <section className="section instagram-cta" id="instagram">
      <div className="wrap">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="kicker">{copy.instagram.kicker}</span>
          <h2 className="section-title">{copy.instagram.title}</h2>
          <p>{copy.instagram.text}</p>
          <motion.a
            className="btn btn--instagram"
            href={profile.instagram}
            target="_blank"
            rel="noreferrer"
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <InstagramIcon />
            {copy.instagram.cta}
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
