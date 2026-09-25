import { motion } from 'motion/react'
import { clinic, copy } from '../data/clinic'
import { Reveal } from './Reveal'

export function Services() {
  return (
    <section className="section services" id="servicos">
      <div className="wrap">
        <Reveal className="services__head">
          <span className="kicker">{copy.services.kicker}</span>
          <h2 className="section-title">{copy.services.title}</h2>
        </Reveal>

        <div className="services__grid">
          <motion.figure
            className="clinic-video"
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <video autoPlay muted loop playsInline aria-hidden="true">
              <source src="/working-video.mp4" type="video/mp4" />
            </video>
            <figcaption>Nossa clínica no centro de {clinic.city}</figcaption>
          </motion.figure>

          <div className="services__cards">
            <motion.article
              className="service-card"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
            >
              <h3>{copy.services.smile.title}</h3>
              <p>{copy.services.smile.text}</p>
            </motion.article>

            <motion.article
              className="service-card"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
            >
              <h3>{copy.services.face.title}</h3>
              <p>{copy.services.face.text}</p>
            </motion.article>
          </div>
        </div>
      </div>
    </section>
  )
}
