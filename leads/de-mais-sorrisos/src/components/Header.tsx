import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { clinic } from '../data/clinic'
import { whatsappUrl } from '../lib/whatsapp'
import { CloseIcon, MenuIcon, WhatsAppIcon } from './icons'

const links = [
  { href: '#servicos', label: 'Serviços' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#agendar', label: 'Agendar' },
  { href: '#local', label: 'Local' },
  { href: '#depoimentos', label: 'Depoimentos' },
]

export function Header() {
  const [overHero, setOverHero] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('topo')
    if (!hero) return

    const observer = new IntersectionObserver(
      ([entry]) => setOverHero(entry.isIntersecting),
      { threshold: 0.35 },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-locked', open)
    return () => document.body.classList.remove('is-locked')
  }, [open])

  const close = () => setOpen(false)

  return (
    <motion.header
      className={`site-header${overHero && !open ? '' : ' is-scrolled'}`}
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="site-header__inner">
        <a className="brand" href="#topo" onClick={close}>
          D<span className="brand__plus">+</span> Sorrisos
        </a>

        <nav className="nav" aria-label="Principal">
          {links.map((link) => (
            <motion.a key={link.href} href={link.href} whileHover={{ y: -2 }}>
              {link.label}
            </motion.a>
          ))}
        </nav>

        <motion.a
          className="btn btn--whatsapp"
          href={whatsappUrl()}
          target="_blank"
          rel="noreferrer"
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <WhatsAppIcon />
          WhatsApp
        </motion.a>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            className="mobile-nav"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
          >
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={close}>
                {link.label}
              </a>
            ))}
            <a className="btn btn--whatsapp" href={whatsappUrl()} target="_blank" rel="noreferrer">
              <WhatsAppIcon />
              Falar no WhatsApp
            </a>
            <small>{clinic.city}</small>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </motion.header>
  )
}
