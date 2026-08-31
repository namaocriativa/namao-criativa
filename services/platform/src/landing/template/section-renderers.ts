import type {
  DesignSystem,
  GeneratedSection,
  LandingSectionConfig,
  LeadBrief,
  SectionContentPayload,
  SitePlan,
} from '../pipeline.types';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replaceAll('"', '&quot;');
}

function allowedImage(brief: LeadBrief, ref: string | undefined): string | null {
  if (!ref) return null;
  return brief.images.some((img) => img.publicPath === ref) ? ref : null;
}

function logoPath(brief: LeadBrief): string | null {
  const logo = brief.images.find((img) => img.kind === 'logo');
  return logo?.publicPath || null;
}

function photoPaths(brief: LeadBrief): string[] {
  return brief.images.filter((img) => img.kind === 'photo').map((i) => i.publicPath);
}

function sectionType(section: GeneratedSection, plan: SitePlan): string {
  return (
    section.type ||
    plan.sectionConfigs.find((item) => item.id === section.id)?.type ||
    section.id
  );
}

function sectionConfig(
  plan: SitePlan,
  id: string,
): LandingSectionConfig | undefined {
  return plan.sectionConfigs.find((item) => item.id === id);
}

export function renderSectionHtml(opts: {
  section: GeneratedSection;
  brief: LeadBrief;
  plan: SitePlan;
}): string {
  const { section, brief, plan } = opts;
  const c = section.content || {};
  const type = sectionType(section, plan);
  switch (type) {
    case 'header':
      return renderHeader(c, brief, plan, section.id);
    case 'hero':
      return renderHero(c, brief, plan, section.id);
    case 'services':
      return renderServices(c, brief, section.id);
    case 'about':
      return renderAbout(c, brief, section.id);
    case 'gallery':
      return renderGallery(c, brief, section.id);
    case 'testimonials':
      return renderTestimonials(c, brief, section.id);
    case 'faq':
      return renderFaq(c, section.id);
    case 'cta':
      return renderCta(c, plan, section.id);
    case 'contact':
      return renderContact(c, brief, plan, section.id);
    case 'footer':
      return renderFooter(c, brief, section.id);
    default:
      return renderCustom(c, plan, section.id);
  }
}

function navItems(c: SectionContentPayload, plan: SitePlan) {
  if (c.nav?.length) return c.nav;
  return plan.sectionConfigs
    .filter((item) => item.type !== 'header' && item.type !== 'footer')
    .map((item) => ({
      label: item.title,
      href: `#${item.id}`,
    }));
}

function renderHeader(
  c: SectionContentPayload,
  brief: LeadBrief,
  plan: SitePlan,
  id: string,
): string {
  const logo = logoPath(brief);
  const nav = navItems(c, plan);
  const cta =
    c.ctaHref && c.ctaLabel
      ? `<a class="btn" href="${escapeAttr(c.ctaHref)}">${escapeHtml(c.ctaLabel)}</a>`
      : plan.primaryCta
        ? `<a class="btn" href="${escapeAttr(plan.primaryCta.href)}">${escapeHtml(plan.primaryCta.label)}</a>`
        : '';

  const brandHref =
    plan.sectionConfigs.find((item) => item.type === 'hero')?.id || 'hero';

  return `<header class="site-header" id="${escapeAttr(id)}">
  <div class="container site-header__inner">
    <a class="brand" href="#${escapeAttr(brandHref)}">
      ${logo ? `<img src="${escapeAttr(logo)}" alt="" />` : ''}
      <span>${escapeHtml(brief.name)}</span>
    </a>
    <nav class="nav" aria-label="Principal">
      ${nav.map((item) => `<a href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a>`).join('\n      ')}
      ${cta}
    </nav>
  </div>
</header>`;
}

function renderHero(
  c: SectionContentPayload,
  brief: LeadBrief,
  plan: SitePlan,
  id: string,
): string {
  const photos = photoPaths(brief);
  const image = allowedImage(brief, c.imageRefs?.[0]) || photos[0] || null;
  const title = c.title || brief.name;
  const eyebrow =
    c.eyebrow ||
    [brief.category, [brief.city, brief.state].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' · ') ||
    '';
  const subtitle = c.subtitle || brief.description || '';
  const ctaHref = c.ctaHref || plan.primaryCta?.href;
  const ctaLabel = c.ctaLabel || plan.primaryCta?.label;

  return `<section class="hero" id="${escapeAttr(id)}">
  ${image ? `<img class="hero__media" src="${escapeAttr(image)}" alt="" />` : ''}
  <div class="container hero__content">
    ${eyebrow ? `<p class="hero__eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="hero__subtitle">${escapeHtml(subtitle)}</p>` : ''}
    ${
      ctaHref && ctaLabel
        ? `<div class="hero__actions"><a class="btn" href="${escapeAttr(ctaHref)}">${escapeHtml(ctaLabel)}</a></div>`
        : ''
    }
  </div>
</section>`;
}

function renderServices(
  c: SectionContentPayload,
  brief: LeadBrief,
  id: string,
): string {
  const items = c.items?.length ? c.items : brief.services || [];
  if (!items.length) return '';
  return `<section class="section section--surface" id="${escapeAttr(id)}">
  <div class="container">
    <h2 class="section__title">${escapeHtml(c.title || 'Serviços')}</h2>
    ${c.subtitle ? `<p class="section__lead">${escapeHtml(c.subtitle)}</p>` : ''}
    <div class="services-grid">
      ${items
        .map((item) => `<article class="service-card"><p>${escapeHtml(item)}</p></article>`)
        .join('\n      ')}
    </div>
  </div>
</section>`;
}

function renderAbout(
  c: SectionContentPayload,
  brief: LeadBrief,
  id: string,
): string {
  const body = c.body || brief.description || '';
  if (!body && brief.rating == null) return '';
  const rating =
    brief.rating != null
      ? `<p class="section__lead">Avaliação ${brief.rating}${
          brief.reviewCount != null ? ` · ${brief.reviewCount} avaliações` : ''
        }</p>`
      : '';
  return `<section class="section" id="${escapeAttr(id)}">
  <div class="container">
    <h2 class="section__title">${escapeHtml(c.title || 'Sobre')}</h2>
    ${rating}
    ${body ? `<p>${escapeHtml(body)}</p>` : ''}
  </div>
</section>`;
}

function renderGallery(
  c: SectionContentPayload,
  brief: LeadBrief,
  id: string,
): string {
  const refs = (c.imageRefs?.length ? c.imageRefs : photoPaths(brief))
    .map((ref) => allowedImage(brief, ref))
    .filter((ref): ref is string => Boolean(ref));
  if (!refs.length) return '';
  return `<section class="section section--surface" id="${escapeAttr(id)}">
  <div class="container">
    <h2 class="section__title">${escapeHtml(c.title || 'Galeria')}</h2>
    <div class="gallery-grid">
      ${refs.map((src) => `<img src="${escapeAttr(src)}" alt="" loading="lazy" />`).join('\n      ')}
    </div>
  </div>
</section>`;
}

function renderTestimonials(
  c: SectionContentPayload,
  brief: LeadBrief,
  id: string,
): string {
  if (brief.rating == null && !c.body && !c.items?.length) return '';
  const rating =
    brief.rating != null
      ? `<p class="proof__score">${escapeHtml(String(brief.rating))}${
          brief.reviewCount != null
            ? ` <span>· ${escapeHtml(String(brief.reviewCount))} avaliações</span>`
            : ''
        }</p>`
      : '';
  return `<section class="section" id="${escapeAttr(id)}">
  <div class="container">
    <h2 class="section__title">${escapeHtml(c.title || 'Avaliações')}</h2>
    ${c.subtitle ? `<p class="section__lead">${escapeHtml(c.subtitle)}</p>` : ''}
    ${rating}
    ${c.body ? `<p>${escapeHtml(c.body)}</p>` : ''}
  </div>
</section>`;
}

function renderFaq(c: SectionContentPayload, id: string): string {
  const items = c.items || [];
  if (!items.length && !c.body) return '';
  return `<section class="section section--surface" id="${escapeAttr(id)}">
  <div class="container">
    <h2 class="section__title">${escapeHtml(c.title || 'Perguntas frequentes')}</h2>
    ${c.subtitle ? `<p class="section__lead">${escapeHtml(c.subtitle)}</p>` : ''}
    ${
      items.length
        ? `<dl class="faq-list">${items
            .map((item) => `<div><dt>${escapeHtml(item)}</dt></div>`)
            .join('')}</dl>`
        : ''
    }
    ${c.body ? `<p>${escapeHtml(c.body)}</p>` : ''}
  </div>
</section>`;
}

function renderCta(
  c: SectionContentPayload,
  plan: SitePlan,
  id: string,
): string {
  const href = c.ctaHref || plan.primaryCta?.href;
  const label = c.ctaLabel || plan.primaryCta?.label;
  if (!href || !label) return '';
  return `<section class="section cta-band" id="${escapeAttr(id)}">
  <div class="container">
    <h2 class="section__title">${escapeHtml(c.title || 'Fale conosco')}</h2>
    ${c.subtitle ? `<p class="section__lead">${escapeHtml(c.subtitle)}</p>` : ''}
    <a class="btn" href="${escapeAttr(href)}">${escapeHtml(label)}</a>
  </div>
</section>`;
}

function renderContact(
  c: SectionContentPayload,
  brief: LeadBrief,
  plan: SitePlan,
  id: string,
): string {
  const items: string[] = [];
  const { contacts } = brief;
  if (contacts.phone) {
    items.push(
      `<li><a href="tel:${escapeAttr(contacts.phone.replace(/\s/g, ''))}">${escapeHtml(contacts.phone)}</a></li>`,
    );
  }
  if (contacts.whatsappUrl) {
    items.push(
      `<li><a href="${escapeAttr(contacts.whatsappUrl)}" target="_blank" rel="noreferrer">WhatsApp</a></li>`,
    );
  }
  if (contacts.email) {
    items.push(
      `<li><a href="mailto:${escapeAttr(contacts.email)}">${escapeHtml(contacts.email)}</a></li>`,
    );
  }
  if (brief.address) {
    items.push(`<li>${escapeHtml(brief.address)}</li>`);
  }
  if (contacts.mapsUrl) {
    items.push(
      `<li><a href="${escapeAttr(contacts.mapsUrl)}" target="_blank" rel="noreferrer">Ver no mapa</a></li>`,
    );
  }
  if (contacts.instagram) {
    items.push(
      `<li><a href="${escapeAttr(contacts.instagram)}" target="_blank" rel="noreferrer">Instagram</a></li>`,
    );
  }
  if (contacts.facebook) {
    items.push(
      `<li><a href="${escapeAttr(contacts.facebook)}" target="_blank" rel="noreferrer">Facebook</a></li>`,
    );
  }
  if (contacts.linkedin) {
    items.push(
      `<li><a href="${escapeAttr(contacts.linkedin)}" target="_blank" rel="noreferrer">LinkedIn</a></li>`,
    );
  }
  if (!items.length) return '';

  const cta =
    (c.ctaHref && c.ctaLabel) || plan.primaryCta
      ? `<p style="margin-top:1.25rem"><a class="btn" href="${escapeAttr(
          c.ctaHref || plan.primaryCta!.href,
        )}">${escapeHtml(c.ctaLabel || plan.primaryCta!.label)}</a></p>`
      : '';

  return `<section class="section" id="${escapeAttr(id)}">
  <div class="container">
    <h2 class="section__title">${escapeHtml(c.title || 'Contato')}</h2>
    ${c.subtitle ? `<p class="section__lead">${escapeHtml(c.subtitle)}</p>` : ''}
    <ul class="contact-list">
      ${items.join('\n      ')}
    </ul>
    ${cta}
  </div>
</section>`;
}

function renderFooter(
  c: SectionContentPayload,
  brief: LeadBrief,
  id: string,
): string {
  const loc = [brief.city, brief.state].filter(Boolean).join(', ');
  return `<footer class="site-footer" id="${escapeAttr(id)}">
  <div class="container">
    <p>${escapeHtml(c.title || brief.name)}${loc ? ` · ${escapeHtml(loc)}` : ''}</p>
  </div>
</footer>`;
}

function renderCustom(
  c: SectionContentPayload,
  plan: SitePlan,
  id: string,
): string {
  const config = sectionConfig(plan, id);
  const title = c.title || config?.title;
  const body = c.body || c.subtitle || '';
  const items = c.items || [];
  if (!title && !body && !items.length) return '';
  return `<section class="section" id="${escapeAttr(id)}">
  <div class="container">
    ${title ? `<h2 class="section__title">${escapeHtml(title)}</h2>` : ''}
    ${c.subtitle && c.subtitle !== body ? `<p class="section__lead">${escapeHtml(c.subtitle)}</p>` : ''}
    ${body ? `<p>${escapeHtml(body)}</p>` : ''}
    ${
      items.length
        ? `<ul class="custom-list">${items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join('')}</ul>`
        : ''
    }
    ${
      c.ctaHref && c.ctaLabel
        ? `<p style="margin-top:1.25rem"><a class="btn" href="${escapeAttr(c.ctaHref)}">${escapeHtml(c.ctaLabel)}</a></p>`
        : ''
    }
  </div>
</section>`;
}

export function buildCssVariables(design: DesignSystem): string {
  return `:root {
  --ink: ${design.colors.ink};
  --paper: ${design.colors.paper};
  --accent: ${design.colors.accent};
  --muted: ${design.colors.muted || '#5b6b7c'};
  --surface: ${design.colors.surface || '#ffffff'};
  --font-display: ${design.fonts.display};
  --font-body: ${design.fonts.body};
  --container: ${design.containerMaxWidth || '1080px'};
  --section-space: ${design.spacing.section || '4.5rem 0'};
}`;
}
