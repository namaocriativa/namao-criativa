export const morningSlots = [
  '08:00',
  '08:40',
  '09:20',
  '10:00',
  '10:40',
  '11:20',
] as const

export const afternoonSlots = [
  '14:00',
  '14:40',
  '15:20',
  '16:00',
  '16:40',
  '17:20',
] as const

export const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export type Goal = 'smile' | 'face'

export type BookingRequest = {
  goal: Goal
  date: string
  time: string
  name: string
  phone: string
  createdAt: string
}

export const BOOKING_STORAGE_KEY = 'dmais-booking-request'

function hash(value: string) {
  let total = 0
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(total)
}

export function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isPastDay(iso: string) {
  const today = startOfDay(new Date())
  const [year, month, day] = iso.split('-').map(Number)
  const candidate = new Date(year, month - 1, day)
  return candidate < today
}

export function isSunday(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay() === 0
}

export function isFullDay(iso: string) {
  if (isPastDay(iso) || isSunday(iso)) return true
  return hash(`full-${iso}`) % 8 === 0
}

export function isSlotTaken(iso: string, time: string) {
  if (isFullDay(iso)) return true
  return hash(`${iso}-${time}`) % 5 === 0
}

export function formatLongDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day))
}

export function goalLabel(goal: Goal) {
  return goal === 'smile' ? 'Cuidar do meu sorriso' : 'Cuidar do meu rosto'
}
