import { copy, profile } from '../data/profile'
import { Reveal } from './Reveal'

export function About() {
  return (
    <section className="section about" id="sobre">
      <div className="wrap about__layout">
        <Reveal>
          <span className="kicker">{copy.about.kicker}</span>
          <h2 className="section-title">{copy.about.title}</h2>
        </Reveal>
        <Reveal delay={0.08} className="about__copy">
          <p>{copy.about.text}</p>
          <p className="about__cred">
            {profile.fullName}
            <span>
              {profile.title} · {profile.approach} · {profile.crp}
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
