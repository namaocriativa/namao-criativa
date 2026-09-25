import { motion } from 'motion/react'
import { clinic } from '../data/clinic'
import { FacebookIcon, InstagramIcon } from './icons'

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
              D<span className="brand__plus">+</span> Sorrisos
            </a>
            <p>
              Odontologia e estética facial no centro de {clinic.city},
              com a {clinic.doctor}.
            </p>
          </div>

          <div>
            <strong>Onde estamos</strong>
            <p>{clinic.address}</p>
            <p>{clinic.hours}</p>
            <p>
              <a href={`tel:+${clinic.whatsapp}`}>{clinic.whatsappDisplay}</a>
            </p>
          </div>

          <div>
            <strong>Redes</strong>
            <div className="footer-social">
              <a
                className="social-chip"
                href={clinic.instagram}
                target="_blank"
                rel="noreferrer"
              >
                <InstagramIcon />
                <span>{clinic.instagramHandle}</span>
              </a>
              <a
                className="social-chip"
                href={clinic.facebook}
                target="_blank"
                rel="noreferrer"
              >
                <FacebookIcon />
                <span>{clinic.facebookHandle}</span>
              </a>
            </div>
          </div>
        </div>
        <small>
          {clinic.doctor} · {clinic.cro}
        </small>
      </div>
    </motion.footer>
  )
}
