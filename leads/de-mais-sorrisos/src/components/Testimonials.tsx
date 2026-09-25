import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { copy, testimonials } from '../data/clinic'
import { Reveal } from './Reveal'

export function Testimonials() {
  const [index, setIndex] = useState(0)
  const current = testimonials[index]

  function go(direction: -1 | 1) {
    setIndex((value) => {
      const next = value + direction
      if (next < 0) return testimonials.length - 1
      if (next >= testimonials.length) return 0
      return next
    })
  }

  return (
    <section className="section testimonials" id="depoimentos">
      <div className="wrap">
        <Reveal>
          <span className="kicker">{copy.testimonials.kicker}</span>
          <h2 className="section-title">{copy.testimonials.title}</h2>
        </Reveal>

        <div className="carousel">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={current.name}
              className="quote"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <p>“{current.text}”</p>
              <footer>
                {current.name} · {current.city}
              </footer>
            </motion.blockquote>
          </AnimatePresence>

          <div className="carousel-nav">
            <button type="button" className="icon-btn" aria-label="Depoimento anterior" onClick={() => go(-1)}>
              ‹
            </button>
            <div className="dots">
              {testimonials.map((item, itemIndex) => (
                <button
                  key={item.name}
                  type="button"
                  className={itemIndex === index ? 'is-on' : ''}
                  aria-label={`Ver depoimento de ${item.name}`}
                  onClick={() => setIndex(itemIndex)}
                />
              ))}
            </div>
            <button type="button" className="icon-btn" aria-label="Próximo depoimento" onClick={() => go(1)}>
              ›
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
