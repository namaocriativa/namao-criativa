import { motion } from 'motion/react'
import { profile } from '../data/profile'
import { whatsappUrl } from '../lib/whatsapp'
import { InstagramIcon, WhatsAppIcon } from './icons'

export function Footer() {
  return (
    <motion.footer
      className="site-footer"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="wrap">
        <div className="site-footer__grid">
          <div>
            <a className="brand" href="#topo">
              {profile.name}
            </a>
            <p>
              Terapia online para mulheres — autoestima, recomeços e o cuidado
              de se fortalecer de dentro.
            </p>
          </div>

          <div>
            <strong>Atendimento</strong>
            <p>Sessões online</p>
            <p>
              <a href={`tel:+${profile.whatsapp}`}>{profile.whatsappDisplay}</a>
            </p>
          </div>

          <div>
            <strong>Redes</strong>
            <div className="footer-social">
              <a
                className="social-chip"
                href={whatsappUrl()}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon />
                <span>WhatsApp</span>
              </a>
              <a
                className="social-chip"
                href={profile.instagram}
                target="_blank"
                rel="noreferrer"
              >
                <InstagramIcon />
                <span>{profile.instagramHandle}</span>
              </a>
            </div>
          </div>
        </div>
        <small>
          {profile.fullName} · {profile.title} · {profile.crp}
        </small>
      </div>
    </motion.footer>
  )
}
