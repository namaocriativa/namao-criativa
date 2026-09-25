import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Differentials } from './Differentials'
import { clinic, copy } from '../data/clinic'
import { fadeUp, stagger } from '../lib/motion'

function useDesktopHero() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)')
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isDesktop
}

export function Hero() {
  const reduceMotion = useReducedMotion()
  const isDesktop = useDesktopHero()

  return (
    <section className="hero" id="topo" aria-label="Apresentação">
      {isDesktop && !reduceMotion ? (
        <video
          className="hero__media hero__media--bg"
          autoPlay
          muted
          loop
          playsInline
          poster="/carla-perfil.png"
          aria-hidden="true"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
      ) : null}

      {reduceMotion ? (
        <img className="hero__media" src="/carla-perfil.png" alt="" />
      ) : (
        <figure className="hero__portrait">
          <video
            className="hero__talk"
            autoPlay
            muted
            loop
            playsInline
            poster="/carla-perfil.png"
            aria-hidden="true"
          >
            <source src="/snapinsta-1786993642510.mp4" type="video/mp4" />
          </video>
          <figcaption>
            <span>{clinic.doctor}</span>
            <small>{clinic.cro}</small>
          </figcaption>
        </figure>
      )}

      <div className="hero__overlay" />

      <div className="wrap hero__stage">
        <motion.div
          className="hero__content"
          variants={stagger}
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
        >
          <motion.span className="kicker" variants={fadeUp}>
            {copy.hero.kicker}
          </motion.span>
          <motion.h1 variants={fadeUp}>{copy.hero.headline}</motion.h1>
          <motion.p variants={fadeUp}>{copy.hero.subtitle}</motion.p>
          <motion.a
            className="btn btn--hero"
            href="#agendar"
            variants={fadeUp}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            {copy.hero.cta}
          </motion.a>
        </motion.div>
      </div>
      <Differentials />
    </section>
  )
}
