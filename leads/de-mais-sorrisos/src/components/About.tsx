import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { clinic, copy } from '../data/clinic'
import { Reveal } from './Reveal'

export function About() {
  const portraitRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: portraitRef,
    offset: ['start end', 'end start'],
  })
  const imageY = useTransform(scrollYProgress, [0, 1], [36, -36])

  return (
    <section className="section about" id="sobre">
      <div className="wrap about__grid">
        <motion.figure
          ref={portraitRef}
          className="about__portrait"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            style={{ y: imageY }}
            src="/carla-perfil.png"
            alt="Dra. Carla Paixão, responsável pela D+ Sorrisos"
          />
        </motion.figure>

        <Reveal className="about__copy">
          <span className="kicker">{copy.about.kicker}</span>
          <h2 className="section-title">{copy.about.title}</h2>
          <p>{copy.about.text}</p>

          <div className="about__gallery">
            <motion.figure
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -6 }}
            >
              <img
                src="/carla-com-almofada-de-dente.png"
                alt="Dra. Carla Paixão em um momento acolhedor na clínica"
              />
            </motion.figure>
            <motion.figure
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -6 }}
            >
              <img src="/about-us.png" alt={`Equipe da ${clinic.name}`} />
            </motion.figure>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
