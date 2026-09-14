import { FAQ_ITEMS } from './faq';
import {
  SITE_EMAIL,
  SITE_NAME,
  SITE_PHONE_DISPLAY,
  SITE_SHORT_NAME,
  WHATSAPP_URL,
  instagramUrl,
} from './site';

function navLink(href: string, label: string, path: string, extraClass = ''): string {
  const current =
    href === path || (href !== '/' && path.startsWith(`${href}/`));
  const cls = extraClass ? ` class="${extraClass}"` : '';
  const aria = current ? ' aria-current="page"' : '';
  return `<a href="${href}"${cls}${aria}>${label}</a>`;
}

export function renderMarketingNav(path: string): string {
  return `<header class="site-nav">
      <a class="nav-brand" href="/">
        <img src="/logo-mark.png" alt="${SITE_NAME}" width="40" height="40" decoding="async" />
        <span>${SITE_SHORT_NAME}</span>
      </a>
      <nav>
        ${navLink('/servicos', 'Serviços', path)}
        ${navLink('/cases', 'Cases', path)}
        ${navLink('/sobre', 'Sobre', path, 'nav-more')}
        ${navLink('/faq', 'FAQ', path, 'nav-more')}
        ${navLink('/login.html', 'Entrar', path)}
      </nav>
    </header>`;
}

function socialItem(opts: {
  href: string;
  label: string;
  detail: string;
  icon: string;
  external?: boolean;
}): string {
  const extra = opts.external
    ? ' target="_blank" rel="noopener noreferrer"'
    : '';
  return `<li>
              <a class="footer-social" href="${opts.href}"${extra}>
                <span class="footer-social-icon" aria-hidden="true">${opts.icon}</span>
                <span>
                  <strong>${opts.label}</strong>
                  <small>${opts.detail}</small>
                </span>
              </a>
            </li>`;
}

const ICON_WHATSAPP = `<svg viewBox="0 0 24 24" fill="none"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.8 7.3L3.5 20.5l1.7-4.1A8.5 8.5 0 1 1 20.5 11.6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.2 8.8c.2-.5.4-.5.7-.5h.6c.2 0 .4.1.5.4l.8 1.9c.1.2 0 .5-.2.6l-.5.4c-.2.1-.2.3 0 .5.4.6.9 1.1 1.5 1.5.2.2.4.1.5 0l.4-.5c.2-.2.4-.3.6-.2l1.9.8c.3.1.4.3.4.5v.6c0 .3 0 .5-.5.7-1 .5-2.4.4-4.1-.8-1.6-1.2-2.6-2.8-2.8-4.3-.1-.7 0-1.3.2-1.6Z" fill="currentColor"/></svg>`;

const ICON_MAIL = `<svg viewBox="0 0 24 24" fill="none"><rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M4 7.2 12 13l8-5.8" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>`;

const ICON_IG = `<svg viewBox="0 0 24 24" fill="none"><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.6" stroke="currentColor" stroke-width="1.6"/><circle cx="16.8" cy="7.2" r="1" fill="currentColor"/></svg>`;

export function renderMarketingFooter(): string {
  const ig = instagramUrl();
  const socials = [
    socialItem({
      href: WHATSAPP_URL,
      label: 'WhatsApp',
      detail: SITE_PHONE_DISPLAY,
      icon: ICON_WHATSAPP,
      external: true,
    }),
    socialItem({
      href: `mailto:${SITE_EMAIL}`,
      label: 'E-mail',
      detail: SITE_EMAIL,
      icon: ICON_MAIL,
    }),
  ];
  if (ig) {
    socials.push(
      socialItem({
        href: ig,
        label: 'Instagram',
        detail: ig.replace('https://www.', ''),
        icon: ICON_IG,
        external: true,
      }),
    );
  }

  return `<footer class="site-footer">
      <div class="footer-inner">
        <p class="footer-mark">
          <img src="/logo-footer.png" alt="" width="220" height="160" decoding="async" />
          <span>${SITE_NAME}</span>
        </p>

        <div class="footer-grid">
          <div class="footer-block">
            <p class="kicker">Fale com a gente</p>
            <p class="footer-nap">Agência digital · Leme e região · interior de São Paulo</p>
            <ul class="footer-socials">
            ${socials.join('\n            ')}
            </ul>
          </div>

          <nav class="footer-block" aria-label="Rodapé">
            <p class="kicker">Navegar</p>
            <ul class="footer-nav">
              <li><a href="/servicos">Serviços</a></li>
              <li><a href="/cases">Cases</a></li>
              <li><a href="/sobre">Sobre</a></li>
              <li><a href="/faq">FAQ</a></li>
              <li><a href="/register.html">Criar conta</a></li>
              <li><a href="/login.html">Entrar</a></li>
              <li><a href="/termos.html">Termos de uso</a></li>
              <li><a href="/privacidade.html">Privacidade</a></li>
            </ul>
          </nav>
        </div>

        <div class="footer-meta">
          <p>© ${new Date().getFullYear()} ${SITE_NAME}</p>
          <nav class="footer-legal" aria-label="Documentos legais">
            <a href="/termos.html">Termos de uso</a>
            <a href="/privacidade.html">Privacidade</a>
          </nav>
          <p>Marketing · software · chatbots · AI</p>
        </div>
      </div>
    </footer>`;
}

export function renderFaqList(): string {
  return FAQ_ITEMS.map(
    (item) => `<details class="faq-item">
          <summary>${item.question}</summary>
          <p>${item.answer}</p>
        </details>`,
  ).join('\n        ');
}
