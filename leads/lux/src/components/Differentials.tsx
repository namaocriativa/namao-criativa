import { motion } from 'motion/react'
import { copy } from '../data/profile'
import { HeartIcon, ShieldIcon, SparkIcon, VideoIcon } from './icons'

const icons = [VideoIcon, SparkIcon, HeartIcon, ShieldIcon]

export function Differentials() {
  return (
    <section className="differentials" aria-label="Diferenciais">
      <ul className="differentials__list wrap">
        {copy.differentials.map((item, index) => {
          const Icon = icons[index]
          return (
            <motion.li
              key={item}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              whileHover={{ y: -3 }}
            >
              <Icon />
              {item}
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}
