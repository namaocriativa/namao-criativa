import './style.css';

function initNav() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 16);
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function initCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  document.body.classList.add('has-cursor');

  window.addEventListener(
    'pointermove',
    (event) => {
      el.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    },
    { passive: true },
  );

  const isHot = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('a, button, input, label'));

  document.addEventListener('pointerover', (event) => {
    if (isHot(event.target)) el.classList.add('is-hot');
  });

  document.addEventListener('pointerout', (event) => {
    if (isHot(event.target)) el.classList.remove('is-hot');
  });
}

initNav();
initCursor();
