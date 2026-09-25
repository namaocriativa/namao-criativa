import { motion } from 'motion/react'
import { clinic } from '../data/clinic'
import { Reveal } from './Reveal'

const mapsQuery = encodeURIComponent(clinic.mapsQuery)
const mapsEmbed = `https://maps.google.com/maps?q=${mapsQuery}&z=16&output=embed`
const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

export function Location() {
  return (
    <section className="section location" id="local">
      <div className="wrap location__grid">
        <Reveal className="location__copy">
          <span className="kicker">Como chegar</span>
          <h2 className="section-title">Estamos no centro de {clinic.city}</h2>
          <p>{clinic.address}</p>
          <p>{clinic.hours}</p>
          <p>
            <a href={`tel:+${clinic.whatsapp}`}>{clinic.whatsappDisplay}</a>
          </p>
          <a className="btn btn--primary" href={mapsLink} target="_blank" rel="noreferrer">
            Abrir no Google Maps
          </a>
        </Reveal>

        <motion.div
          className="location__map"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <iframe
            title={`Mapa da ${clinic.name} em ${clinic.city}`}
            src={mapsEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </motion.div>
      </div>
    </section>
  )
}
