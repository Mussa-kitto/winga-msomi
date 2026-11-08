/* ================================================================
   WINGA MSOMI — render.js
   Catalogue helpers + functions that draw UI from js/data/*.js.
   Needs: data/*.js, whatsapp.js
   ================================================================ */
window.WM = window.WM || {};

/* ── CATALOGUE HELPERS ──────────────────────────────────────────── */
WM.catalog = (function () {
  const site = WM.site || {};
  const products = WM.products || [];
  const categories = WM.categories || [];
  const sellers = WM.sellers || [];

  const category = key => categories.find(c => c.key === key);
  const seller = id => sellers.find(s => s.id === id);
  const product = id => products.find(p => p.id === id);

  /* Visible = available (or sold while showSold is on) AND seller is active */
  function isVisible(p) {
    const s = seller(p.sellerId);
    if (!s || s.active === false) return false;
    if (p.status === 'available') return true;
    return p.status === 'sold' && !!site.showSold;
  }

  const visible = () => products.filter(isVisible);

  function countByCategory() {
    const counts = {};
    visible().forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }

  /* Dev-time data check: only logs on local hosts / file:// */
  function validate() {
    const host = location.hostname;
    const isDev = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
    if (!isDev) return;
    const seen = new Set();
    products.forEach((p, i) => {
      const tag = `[WM data] product #${i} "${p.id}"`;
      if (!p.id) console.warn(`${tag}: missing id`);
      if (seen.has(p.id)) console.warn(`${tag}: duplicate id`);
      seen.add(p.id);
      if (!seller(p.sellerId)) console.warn(`${tag}: unknown sellerId "${p.sellerId}"`);
      if (!category(p.category)) console.warn(`${tag}: unknown category "${p.category}"`);
      if (!Array.isArray(p.images) || !p.images.length) console.warn(`${tag}: missing images`);
      if (typeof p.price !== 'number' || !(p.price > 0)) console.warn(`${tag}: price must be a positive number`);
    });
  }

  return { products, categories, sellers, category, seller, product, isVisible, visible, countByCategory, validate };
})();

/* ── RENDERING ──────────────────────────────────────────────────── */
WM.render = (function () {
  const site = WM.site || {};

  // Escape text before putting it into HTML
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function badgeHtml(p) {
    const key = p.status === 'sold' ? 'sold' : p.badge;
    const b = key && site.badges && site.badges[key];
    if (!b) return '';
    return `<span class="pbadge ${esc(b.cls)}"><i class="${esc(b.icon)}"></i> ${esc(b.label)}</span>`;
  }

  /* One product card (same markup/classes as the original hand-written cards) */
  function card(p) {
    const cat = WM.catalog.category(p.category) || {};
    const icon = p.icon || cat.icon || 'fa-solid fa-box-open';
    const sold = p.status === 'sold';
    return `
      <article class="pcard" data-cat="${esc(p.category)}" data-id="${esc(p.id)}">
        <div class="pcard-img">
          <div class="shimmer"></div>
          <img src="${esc(p.images[0])}" alt="${esc(p.alt || p.name)}" loading="lazy"/>
          ${badgeHtml(p)}
        </div>
        <div class="pcard-body">
          <div class="pcat"><i class="${esc(icon)}"></i> ${esc(cat.fullLabel || cat.label || p.category)}</div>
          <h3 class="pname">${esc(p.name)}</h3>
          <p class="pdesc">${esc(p.description)}</p>
          <div class="pfoot">
            <div class="pprice"><span class="cur">TZS </span>${WM.wa.money(p.price)}</div>
            ${sold ? '' : `
            <a href="${esc(WM.wa.productOrderLink(p))}" class="btn-order" target="_blank" rel="noopener">
              <i class="fa-brands fa-whatsapp"></i> Order
            </a>`}
          </div>
        </div>
      </article>`;
  }

  // Fill a container with cards, in data order
  function grid(el, list) {
    el.innerHTML = list.map(card).join('');
  }

  // Category filter buttons: "Zote" + one per category that has visible products
  function catBar(el) {
    const counts = WM.catalog.countByCategory();
    const btn = (key, icon, label, active) =>
      `<button class="cat-btn${active ? ' active' : ''}" data-cat="${esc(key)}"><i class="${esc(icon)}"></i> ${esc(label)}</button>`;
    el.innerHTML = btn('all', 'fa-solid fa-border-all', 'Zote', true) +
      WM.catalog.categories.filter(c => counts[c.key]).map(c => btn(c.key, c.icon, c.label, false)).join('');
  }

  /* Elements with data-wa get a contact link; data-wa="request" -> "find me a product".
     data-wa-text overrides the message. Elements with data-wa-display show the contact number. */
  function contactLinks(root) {
    (root || document).querySelectorAll('[data-wa]').forEach(a => {
      const text = a.dataset.waText;
      a.href = a.dataset.wa === 'request' ? WM.wa.requestLink() : WM.wa.contactLink(text);
    });
    (root || document).querySelectorAll('[data-wa-display]').forEach(el => {
      el.textContent = site.contactDisplay || '';
    });
  }

  return { esc, card, grid, catBar, contactLinks };
})();
