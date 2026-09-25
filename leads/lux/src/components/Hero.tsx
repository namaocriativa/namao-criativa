import { motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { copy, profile } from '../data/profile'
import { fadeUp, stagger } from '../lib/motion'
import { whatsappUrl } from '../lib/whatsapp'
import { Differentials } from './Differentials'

const CalmField = lazy(() =>
  import('./CalmField').then((module) => ({ default: module.CalmField })),
)

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
          aria-hidden="true"
        >
          <source src="/hero-background-video.mp4" type="video/mp4" />
        </video>
      ) : null}

      {reduceMotion ? (
        <div className="hero__media hero__fallback" aria-hidden="true" />
      ) : (
        <figure className="hero__portrait">
          <video
            className="hero__talk"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          >
            <source src="/hero-video-10s.mp4" type="video/mp4" />
          </video>
          <figcaption>
            <span>{profile.name}</span>
            <small>
              {profile.title} · {profile.crp}
            </small>
          </figcaption>
        </figure>
      )}

      <Suspense fallback={null}>
        <CalmField />
      </Suspense>
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
            href={whatsappUrl()}
            target="_blank"
            rel="noreferrer"
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
