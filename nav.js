/* Phone and tablet menu: the Menu button opens a grid of every page. */
(() => {
  const btn = document.getElementById('menuBtn'), panel = document.getElementById('navMenu');
  if (!btn || !panel) return;
  const set = open => {
    btn.setAttribute('aria-expanded', open);
    panel.hidden = !open;
    document.documentElement.classList.toggle('menu-open', open);
  };
  btn.addEventListener('click', () => { set(panel.hidden); if (!panel.hidden && typeof track === 'function') track('menu-open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
  document.addEventListener('click', e => { if (!panel.hidden && !e.target.closest('#navMenu, #menuBtn')) set(false); });
  matchMedia('(min-width: 1101px)').addEventListener('change', e => { if (e.matches) set(false); });
})();
