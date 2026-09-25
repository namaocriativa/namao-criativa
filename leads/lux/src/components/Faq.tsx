import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { copy } from '../data/profile'
import { PlusIcon } from './icons'
import { Reveal } from './Reveal'

export function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <section className="section faq" id="duvidas">
      <div className="wrap faq__layout">
        <Reveal>
          <span className="kicker">{copy.faq.kicker}</span>
          <h2 className="section-title">{copy.faq.title}</h2>
        </Reveal>

        <div className="faq__list">
          {copy.faq.items.map((item, index) => {
            const isOpen = open === index
            return (
              <article key={item.q} className={isOpen ? 'faq-item is-open' : 'faq-item'}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : index)}
                >
                  <span>{item.q}</span>
                  <PlusIcon />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      className="faq-item__body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p>{item.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
