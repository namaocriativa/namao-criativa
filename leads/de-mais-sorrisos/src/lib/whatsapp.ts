import { clinic, copy } from '../data/clinic'

export function whatsappUrl(message = copy.whatsapp.message) {
  return `https://wa.me/${clinic.whatsapp}?text=${encodeURIComponent(message)}`
}
