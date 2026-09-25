import { motion } from 'motion/react'
import { whatsappUrl } from '../lib/whatsapp'
import { WhatsAppIcon } from './icons'

export function WhatsAppFloat() {
  return (
    <motion.a
      className="wa-float"
      href={whatsappUrl()}
      target="_blank"
      rel="noreferrer"
      aria-label="Conversar no WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.9 }}
      whileHover={{ scale: 1.08, y: -3 }}
      whileTap={{ scale: 0.94 }}
    >
      <WhatsAppIcon />
      <span>WhatsApp</span>
    </motion.a>
  )
}
