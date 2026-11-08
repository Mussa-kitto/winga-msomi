/* ================================================================
   WINGA MSOMI — header.js
   Shared header behaviour (every page): live search suggestions,
   "Bidhaa" category dropdown, mobile menu, shadow on scroll.
   Needs: data/*.js, whatsapp.js, render.js
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('navbar');
  if (!header) return;
  const esc = WM.render.esc;
  const onHome = !!document.getElementById('pgrid');
  const base = onHome ? '' : 'index.html';

  /* ── Category menus (dropdown + mobile chips) from categories.js ── */
  document.querySelectorAll('[data-cat-menu]').forEach(el => WM.render.catLinks(el, base, el.tagName === 'UL'));

  /* ── "Bidhaa" dropdown ── */
  const ddBtn = header.querySelector('.hd-dd-btn');
  const ddMenu = ddBtn && document.getElementById(ddBtn.getAttribute('aria-controls'));
  function setDropdown(open, focusFirst) {
    if (!ddBtn) return;
    ddBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    ddMenu.hidden = !open;
    if (open && focusFirst) ddMenu.querySelector('a')?.focus();
  }
  if (ddBtn) {
    ddBtn.addEventListener('click', () => setDropdown(ddMenu.hidden));
    ddBtn.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); setDropdown(true, true); } });
    ddMenu.addEventListener('keydown', e => {
      const links = [...ddMenu.querySelectorAll('a')];
      const i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
      if (e.key === 'Escape') { setDropdown(false); ddBtn.focus(); }
    });
    ddMenu.addEventListener('click', e => { if (e.target.closest('a')) setDropdown(false); });
    document.addEventListener('click', e => { if (!e.target.closest('.hd-dd')) setDropdown(false); });
    ddMenu.addEventListener('focusout', e => { if (!e.relatedTarget || !e.relatedTarget.closest('.hd-dd')) setDropdown(false); });
  }

  /* ── Mobile menu ── */
  const ham = document.getElementById('ham');
  const mobMenu = document.getElementById('mobMenu');
  function setMenu(open) {
    mobMenu.classList.toggle('open', open);
    ham.classList.toggle('open', open);
    ham.setAttribute('aria-expanded', open ? 'true' : 'false');
    ham.setAttribute('aria-label', open ? 'Funga menyu' : 'Fungua menyu');
  }
  if (ham && mobMenu) {
    ham.addEventListener('click', () => setMenu(!mobMenu.classList.contains('open')));
    mobMenu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobMenu.classList.contains('open')) { setMenu(false); ham.focus(); }
    });
  }

  /* ── Shadow when scrolled ── */
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Search with live suggestions (combobox pattern) ── */
  const form = header.querySelector('.hd-search');
  const input = document.getElementById('hdSearch');
  const list = document.getElementById('hdSuggest');
  if (!form || !input || !list) return;
  const MAX = 6;
  let active = -1;

  const norm = s => String(s || '').toLowerCase();
  function matches(q) {
    q = norm(q).trim();
    if (!q) return [];
    const vis = WM.catalog.visible();
    // Name matches first, then description/category matches
    const byName = vis.filter(p => norm(p.name).includes(q));
    const byOther = vis.filter(p => !byName.includes(p) &&
      (norm(p.description).includes(q) || norm((WM.catalog.category(p.category) || {}).label).includes(q)));
    return byName.concat(byOther);
  }
  function highlight(name, q) {
    const i = norm(name).indexOf(norm(q).trim());
    if (i < 0 || !q.trim()) return esc(name);
    const n = q.trim().length;
    return `${esc(name.slice(0, i))}<mark>${esc(name.slice(i, i + n))}</mark>${esc(name.slice(i + n))}`;
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function render() {
    const q = input.value;
    if (!q.trim()) { close(); return; }
    const found = matches(q);
    const shown = found.slice(0, MAX);
    list.innerHTML = shown.length
      ? shown.map((p, i) => `
          <li role="option" id="sg-${i}" data-href="${esc(WM.render.productPage(p))}" aria-selected="false">
            <img src="${esc(p.images[0])}" alt="" width="40" height="40" loading="lazy"/>
            <span class="sg-name">${highlight(p.name, q)}</span>
            <span class="sg-price">TZS ${WM.wa.money(p.price)}</span>
          </li>`).join('') +
        `<li role="option" id="sg-all" class="sg-all" data-search="1" aria-selected="false">Ona matokeo yote (${found.length}) <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></li>`
      : `<li class="sg-empty" role="option" aria-disabled="true">Hakuna bidhaa "${esc(q.trim())}". Bonyeza Tafuta kutuomba WhatsApp.</li>`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  }
  function move(step) {
    const opts = [...list.querySelectorAll('li[id]')];
    if (!opts.length) return;
    active = (active + step + opts.length) % opts.length;
    opts.forEach((o, i) => o.setAttribute('aria-selected', i === active ? 'true' : 'false'));
    input.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  }
  function choose(li) {
    if (!li || li.getAttribute('aria-disabled')) return;
    if (li.dataset.href) location.href = li.dataset.href;
    else submit();
  }
  // Full search: filter the home grid in place, or go to the home page with ?q=
  function submit() {
    const q = input.value.trim();
    close();
    if (onHome) {
      const ps = document.getElementById('productSearch');
      document.querySelector('.cat-btn[data-cat="all"]')?.click();
      ps.value = q;
      ps.dispatchEvent(new Event('input'));
      const products = document.getElementById('products');
      window.scrollTo({ top: products.offsetTop - header.offsetHeight - 12, behavior: 'smooth' });
    } else {
      location.href = `index.html${q ? `?q=${encodeURIComponent(q)}` : ''}#products`;
    }
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); close(); } // keep the typed text
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(list.querySelectorAll('li[id]')[active]); }
  });
  form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  // mousedown (not click) so the choice happens before the input loses focus
  list.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); choose(li); } });
  document.addEventListener('click', e => { if (!e.target.closest('.hd-search')) close(); });
});
