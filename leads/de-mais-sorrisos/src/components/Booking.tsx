import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import {
  afternoonSlots,
  BOOKING_STORAGE_KEY,
  formatLongDate,
  goalLabel,
  isFullDay,
  isPastDay,
  isSlotTaken,
  isSunday,
  monthNames,
  morningSlots,
  toISODate,
  weekDays,
  type BookingRequest,
  type Goal,
} from '../data/booking'
import { copy } from '../data/clinic'
import { isValidMobile, maskPhone } from '../lib/phone'
import { Reveal } from './Reveal'

const steps = [1, 2, 3, 4, 5] as const
const stepTransition = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
}

function calendarCells(month: Date) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: Array<{ day: number; iso: string } | null> = []

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      iso: toISODate(new Date(year, monthIndex, day)),
    })
  }

  return cells
}

function isDayBlocked(iso: string) {
  return isPastDay(iso) || isSunday(iso) || isFullDay(iso)
}

export function Booking() {
  const [step, setStep] = useState<(typeof steps)[number]>(1)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'form' | 'sending' | 'success'>('form')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const todayMonth = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }, [])

  const cells = useMemo(() => calendarCells(month), [month])
  const canGoPrev = month.getTime() > todayMonth.getTime()
  const nameOk = name.trim().split(/\s+/).filter(Boolean).length >= 2
  const canContinue =
    (step === 1 && goal !== null) ||
    (step === 2 && date !== null && time !== null) ||
    (step === 3 && nameOk) ||
    (step === 4 && isValidMobile(phone)) ||
    step === 5

  function goNext() {
    if (!canContinue || step === 5) return
    setStep((current) => (current + 1) as (typeof steps)[number])
  }

  function goBack() {
    if (step === 1) return
    setStep((current) => (current - 1) as (typeof steps)[number])
  }

  function selectDay(iso: string) {
    if (isDayBlocked(iso)) return
    setDate(iso)
    setTime(null)
  }

  function confirm() {
    if (!goal || !date || !time) return
    setStatus('sending')

    const payload: BookingRequest = {
      goal,
      date,
      time,
      name: name.trim(),
      phone,
      createdAt: new Date().toISOString(),
    }

    window.setTimeout(() => {
      localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(payload))
      setStatus('success')
    }, 900)
  }

  return (
    <section className="section booking" id="agendar">
      <div className="wrap booking__layout">
        <Reveal className="booking__intro">
          <span className="kicker">{copy.booking.kicker}</span>
          <h2 className="section-title">{copy.booking.title}</h2>
        </Reveal>

        <motion.div
          className="booking-card"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                className="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 16 }}
              >
                <h3>{copy.booking.successTitle}</h3>
                <p>{copy.booking.successText}</p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="progress" aria-hidden="true">
                  {steps.map((item) => (
                    <motion.span
                      key={item}
                      className={item <= step ? 'is-on' : ''}
                      layout
                      transition={{ duration: 0.35 }}
                    />
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={step} {...stepTransition}>
                    {step === 1 ? (
                      <>
                        <h3>{copy.booking.goalQuestion}</h3>
                        <div className="goal-grid">
                          <motion.button
                            type="button"
                            className={`goal-card${goal === 'smile' ? ' is-selected' : ''}`}
                            onClick={() => setGoal('smile')}
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <strong>{copy.booking.smileGoal}</strong>
                            <span>{copy.booking.smileHint}</span>
                          </motion.button>
                          <motion.button
                            type="button"
                            className={`goal-card${goal === 'face' ? ' is-selected' : ''}`}
                            onClick={() => setGoal('face')}
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <strong>{copy.booking.faceGoal}</strong>
                            <span>{copy.booking.faceHint}</span>
                          </motion.button>
                        </div>
                      </>
                    ) : null}

                    {step === 2 ? (
                      <>
                        <h3>{copy.booking.dateQuestion}</h3>
                        <div className="calendar-layout">
                          <div>
                            <div className="calendar-nav">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label="Mês anterior"
                                disabled={!canGoPrev}
                                onClick={() =>
                                  setMonth(
                                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                                  )
                                }
                              >
                                ‹
                              </button>
                              <strong>
                                {monthNames[month.getMonth()]} {month.getFullYear()}
                              </strong>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label="Próximo mês"
                                onClick={() =>
                                  setMonth(
                                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                                  )
                                }
                              >
                                ›
                              </button>
                            </div>
                            <div className="weekdays">
                              {weekDays.map((day) => (
                                <span key={day}>{day}</span>
                              ))}
                            </div>
                            <div className="days">
                              {cells.map((cell, index) =>
                                cell ? (
                                  <button
                                    key={cell.iso}
                                    type="button"
                                    className={date === cell.iso ? 'is-selected' : ''}
                                    disabled={isDayBlocked(cell.iso)}
                                    onClick={() => selectDay(cell.iso)}
                                  >
                                    {cell.day}
                                  </button>
                                ) : (
                                  <span key={`empty-${index}`} />
                                ),
                              )}
                            </div>
                          </div>

                          <div className="slots">
                            <h4>Manhã</h4>
                            <div className="slot-grid">
                              {morningSlots.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  className={time === slot ? 'is-selected' : ''}
                                  disabled={!date || isSlotTaken(date, slot)}
                                  onClick={() => setTime(slot)}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                            <h4>Tarde</h4>
                            <div className="slot-grid">
                              {afternoonSlots.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  className={time === slot ? 'is-selected' : ''}
                                  disabled={!date || isSlotTaken(date, slot)}
                                  onClick={() => setTime(slot)}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}

                    {step === 3 ? (
                      <div className="field">
                        <label htmlFor="booking-name">{copy.booking.nameQuestion}</label>
                        <input
                          id="booking-name"
                          autoComplete="name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Nome e sobrenome"
                        />
                      </div>
                    ) : null}

                    {step === 4 ? (
                      <div className="field">
                        <label htmlFor="booking-phone">{copy.booking.phoneQuestion}</label>
                        <input
                          id="booking-phone"
                          inputMode="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(event) => setPhone(maskPhone(event.target.value))}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    ) : null}

                    {step === 5 && goal && date && time ? (
                      <>
                        <h3>Confirme os seus dados</h3>
                        <ul className="summary">
                          <li>
                            <span>Objetivo</span>
                            <strong>{goalLabel(goal)}</strong>
                          </li>
                          <li>
                            <span>Dia</span>
                            <strong>{formatLongDate(date)}</strong>
                          </li>
                          <li>
                            <span>Horário</span>
                            <strong>{time}</strong>
                          </li>
                          <li>
                            <span>Nome</span>
                            <strong>{name.trim()}</strong>
                          </li>
                          <li>
                            <span>WhatsApp</span>
                            <strong>{phone}</strong>
                          </li>
                        </ul>
                        <motion.button
                          type="button"
                          className="btn btn--primary btn--wide"
                          disabled={status === 'sending'}
                          onClick={confirm}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          🔒 {status === 'sending' ? 'Enviando…' : copy.booking.confirmCta}
                        </motion.button>
                        <p className="confirm-note">{copy.booking.confirmNote}</p>
                      </>
                    ) : null}
                  </motion.div>
                </AnimatePresence>

                {step < 5 ? (
                  <div className="booking-actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={goBack}
                      disabled={step === 1}
                    >
                      Voltar
                    </button>
                    <motion.button
                      type="button"
                      className="btn btn--primary"
                      onClick={goNext}
                      disabled={!canContinue}
                      whileHover={canContinue ? { scale: 1.03, y: -2 } : undefined}
                      whileTap={canContinue ? { scale: 0.97 } : undefined}
                    >
                      Continuar
                    </motion.button>
                  </div>
                ) : (
                  <div className="booking-actions">
                    <button type="button" className="btn btn--ghost" onClick={goBack}>
                      Voltar
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
