import { copy, profile } from '../data/profile'

export function whatsappUrl(message = copy.whatsapp.message) {
  return `https://wa.me/${profile.whatsapp}?text=${encodeURIComponent(message)}`
}
