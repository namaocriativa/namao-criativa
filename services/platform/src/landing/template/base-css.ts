export const BASE_CSS = `*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--ink);
  background: var(--paper);
  line-height: 1.55;
}

img {
  max-width: 100%;
  display: block;
}

a {
  color: inherit;
  text-decoration: none;
}

.container {
  width: min(var(--container), calc(100% - 2rem));
  margin-inline: auto;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(10px);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}

.site-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand img {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.nav {
  display: none;
  gap: 1rem;
  align-items: center;
}

.nav a {
  color: var(--muted);
  font-size: 0.95rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1.1rem;
  border-radius: 0.35rem;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  border: 0;
}

.hero {
  position: relative;
  min-height: min(88vh, 720px);
  display: grid;
  align-items: end;
  overflow: hidden;
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--ink) 88%, transparent), color-mix(in srgb, var(--accent) 35%, transparent)),
    var(--ink);
  color: #fff;
}

.hero__media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.45;
}

.hero__content {
  position: relative;
  z-index: 1;
  padding: clamp(3rem, 10vw, 6rem) 0 clamp(2.5rem, 6vw, 4rem);
}

.hero__eyebrow {
  margin: 0 0 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  opacity: 0.85;
}

.hero h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 7vw, 4.4rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
  max-width: 12ch;
}

.hero__subtitle {
  margin: 1rem 0 0;
  max-width: 36rem;
  font-size: 1.1rem;
  opacity: 0.92;
}

.hero__actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.section {
  padding: var(--section-space);
}

.section--surface {
  background: var(--surface);
}

.section__title {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 4vw, 2.4rem);
  letter-spacing: -0.02em;
}

.section__lead {
  margin: 0 0 1.75rem;
  color: var(--muted);
  max-width: 40rem;
}

.services-grid,
.gallery-grid {
  display: grid;
  gap: 1rem;
}

.services-grid {
  grid-template-columns: 1fr;
}

.service-card {
  padding: 1.1rem 1.2rem;
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--surface) 70%, var(--paper));
}

.gallery-grid {
  grid-template-columns: 1fr;
}

.gallery-grid img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 0.25rem;
}

.contact-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

.contact-list a {
  color: var(--accent);
  font-weight: 600;
}

.proof__score {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3rem);
  letter-spacing: -0.03em;
}

.proof__score span {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--muted);
}

.faq-list {
  margin: 0;
  display: grid;
  gap: 1rem;
}

.faq-list dt {
  font-weight: 650;
}

.cta-band {
  background: color-mix(in srgb, var(--ink) 92%, var(--accent));
  color: #fff;
}

.cta-band .section__lead {
  color: color-mix(in srgb, #fff 78%, transparent);
}

.custom-list {
  margin: 1rem 0 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.45rem;
}

.site-footer {
  padding: 2rem 0;
  border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  color: var(--muted);
  font-size: 0.95rem;
}

@media (min-width: 720px) {
  .nav {
    display: flex;
  }

  .services-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gallery-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: no-preference) {
  .hero__content,
  .section {
    animation: rise 0.7s ease both;
  }

  .hero__content {
    animation-delay: 0.08s;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
}
`;
