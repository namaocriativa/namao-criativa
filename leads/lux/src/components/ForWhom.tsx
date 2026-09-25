import { motion } from 'motion/react'
import { copy } from '../data/profile'
import { Reveal } from './Reveal'

export function ForWhom() {
  return (
    <section className="section for-whom" id="para-quem">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="kicker">{copy.forWhom.kicker}</span>
          <h2 className="section-title">{copy.forWhom.title}</h2>
        </Reveal>

        <div className="card-grid">
          {copy.forWhom.items.map((item, index) => (
            <motion.article
              key={item.title}
              className="soft-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
            >
              <span className="soft-card__index">0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
