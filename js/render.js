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
            <div class="pactions">
              <button type="button" class="btn-cart" data-add-cart="${esc(p.id)}"
                      aria-label="Ongeza ${esc(p.name)} kwenye Cart" title="Ongeza kwenye Cart">
                <i class="fa-solid fa-cart-plus" aria-hidden="true"></i>
              </button>
              <a href="${esc(WM.wa.productOrderLink(p))}" class="btn-order" target="_blank" rel="noopener">
                <i class="fa-brands fa-whatsapp"></i> Order
              </a>
            </div>`}
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

/* ── CART DRAWER + BADGE + TOAST (every page) ───────────────────────
   Markup is injected by JS so each page only needs:
   - a button with [data-cart-open] (header cart icon)
   - an element with [data-cart-count] (badge)
   - buttons with [data-add-cart="<product id>"] (optional data-qty or
     data-qty-input="<selector of an <input>>")
   Needs: whatsapp.js, store.js
   ─────────────────────────────────────────────────────────────────── */
WM.cartUI = (function () {
  const esc = WM.render.esc;
  const money = WM.wa.money;
  let drawer, overlay, list, foot, toast, lastFocus, toastTimer, clearTimer;

  function mount() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="cart-overlay" data-cart-close></div>
      <aside class="cart-drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" aria-hidden="true">
        <div class="cart-head">
          <h2 id="cartTitle"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Cart Yako</h2>
          <button type="button" class="cart-close" data-cart-close aria-label="Funga cart">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="cart-body"><ul class="cart-list" aria-label="Bidhaa kwenye cart"></ul></div>
        <div class="cart-foot"></div>
      </aside>
      <div class="wm-toast" role="status" aria-live="polite"></div>`);

    drawer = document.getElementById('cartDrawer');
    overlay = document.querySelector('.cart-overlay');
    list = drawer.querySelector('.cart-list');
    foot = drawer.querySelector('.cart-foot');
    toast = document.querySelector('.wm-toast');

    // One delegated click handler for the whole page
    document.addEventListener('click', onClick);
    list.addEventListener('change', onQtyInput);
    document.addEventListener('keydown', onKey);
    window.addEventListener('wm:cart', update);
    update();
  }

  /* ── open / close ── */
  const isOpen = () => drawer.classList.contains('open');

  function open() {
    lastFocus = document.activeElement;
    drawer.classList.add('open');
    overlay.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-open');
    document.querySelectorAll('[data-cart-open]').forEach(b => b.setAttribute('aria-expanded', 'true'));
    setTimeout(() => drawer.querySelector('.cart-close').focus(), 50);
  }

  function close() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-open');
    document.querySelectorAll('[data-cart-open]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the drawer
    const f = [...drawer.querySelectorAll('a[href], button:not([disabled]), input')].filter(el => el.offsetParent !== null && el.tabIndex !== -1);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ── clicks anywhere on the page ── */
  function onClick(e) {
    const t = e.target.closest('[data-cart-open], [data-cart-close], [data-add-cart], [data-qty-step], [data-cart-remove], [data-cart-clear]');
    if (!t) return;

    if (t.matches('[data-cart-open]')) { e.preventDefault(); open(); return; }
    if (t.matches('[data-cart-close]')) { close(); return; }

    if (t.matches('[data-add-cart]')) {
      e.preventDefault();
      e.stopPropagation(); // don't trigger a card link behind the button
      const input = t.dataset.qtyInput && document.querySelector(t.dataset.qtyInput);
      const qty = input ? input.value : (t.dataset.qty || 1);
      const p = WM.catalog.product(t.dataset.addCart);
      if (p && WM.cart.add(p.id, qty)) {
        showToast(`<i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <span>${esc(p.name)} imeongezwa kwenye cart</span>
          <button type="button" class="wm-toast-btn" data-cart-open>Tazama cart</button>`);
        t.classList.add('added');
        setTimeout(() => t.classList.remove('added'), 900);
      }
      return;
    }

    if (t.matches('[data-qty-step]')) {
      const line = WM.cart.lines().find(l => l.product.id === t.dataset.id);
      if (line) WM.cart.setQty(t.dataset.id, line.qty + Number(t.dataset.qtyStep));
      return;
    }
    if (t.matches('[data-cart-remove]')) { WM.cart.remove(t.dataset.cartRemove); return; }

    if (t.matches('[data-cart-clear]')) {
      // Two-step clear instead of a confirm() dialog
      if (t.dataset.armed) { clearTimeout(clearTimer); WM.cart.clear(); return; }
      t.dataset.armed = '1';
      t.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Bonyeza tena kufuta';
      clearTimer = setTimeout(update, 3000);
    }
  }

  function onQtyInput(e) {
    const input = e.target.closest('input[data-qty-for]');
    if (input) WM.cart.setQty(input.dataset.qtyFor, input.value);
  }

  function showToast(html) {
    toast.innerHTML = html;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  /* ── draw badge + drawer contents ── */
  function update() {
    const count = WM.cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = count > 99 ? '99+' : count;
      el.hidden = count === 0;
    });
    document.querySelectorAll('[data-cart-open]:not(.wm-toast-btn)').forEach(b =>
      b.setAttribute('aria-label', `Fungua cart (bidhaa ${count})`));
    if (!drawer) return;

    // Remember focus so +/- buttons keep focus after re-render
    const a = document.activeElement;
    const focusKey = a && drawer.contains(a) ? a.dataset.focusKey : null;

    const lines = WM.cart.lines();
    if (!lines.length) {
      list.innerHTML = `
        <li class="cart-empty">
          <i class="fa-solid fa-basket-shopping" aria-hidden="true"></i>
          <strong>Cart yako iko tupu</strong>
          <span>Ongeza bidhaa unazotaka, kisha tuma oda moja kwa WhatsApp.</span>
          <a href="index.html#products" class="cart-browse" data-cart-close>Tazama bidhaa</a>
        </li>`;
      foot.innerHTML = '';
    } else {
      list.innerHTML = lines.map(lineHtml).join('');
      foot.innerHTML = footHtml(lines);
    }

    if (focusKey) {
      const el = drawer.querySelector(`[data-focus-key="${focusKey}"]`);
      if (el && !el.disabled) el.focus();
      else drawer.querySelector('.cart-close').focus();
    }
  }

  function lineHtml(l) {
    const p = l.product, id = esc(p.id), url = `product.html?id=${encodeURIComponent(p.id)}`;
    return `
      <li class="citem">
        <a href="${url}" class="citem-img" tabindex="-1" aria-hidden="true">
          <img src="${esc(p.images[0])}" alt="" width="72" height="72" loading="lazy"/>
        </a>
        <div class="citem-info">
          <a href="${url}" class="citem-name">${esc(p.name)}</a>
          <span class="citem-price">TZS ${money(p.price)} kila moja</span>
          <div class="citem-row">
            <div class="qty" role="group" aria-label="Idadi ya ${esc(p.name)}">
              <button type="button" data-qty-step="-1" data-id="${id}" data-focus-key="dec-${id}" aria-label="Punguza idadi" ${l.qty <= 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-minus" aria-hidden="true"></i></button>
              <input type="number" inputmode="numeric" min="1" max="${WM.cart.MAX_QTY}" value="${l.qty}"
                     data-qty-for="${id}" data-focus-key="in-${id}" aria-label="Idadi"/>
              <button type="button" data-qty-step="1" data-id="${id}" data-focus-key="inc-${id}" aria-label="Ongeza idadi" ${l.qty >= WM.cart.MAX_QTY ? 'disabled' : ''}>
                <i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            </div>
            <strong class="citem-sub">TZS ${money(l.subtotal)}</strong>
          </div>
        </div>
        <button type="button" class="citem-remove" data-cart-remove="${id}" aria-label="Ondoa ${esc(p.name)} kwenye cart">
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        </button>
      </li>`;
  }

  function footHtml(lines) {
    const orders = WM.wa.cartOrders(lines);
    const many = orders.length > 1;
    const buttons = orders.map(o => {
      const label = many ? `Tuma Oda kwa ${esc(o.sellers.join(', '))} · TZS ${money(o.total)}` : 'Tuma Oda WhatsApp';
      if (o.tooLong) {
        return `<p class="cart-warn"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
          Oda hii ni ndefu sana kwa ujumbe mmoja wa WhatsApp. Tafadhali igawanye: ondoa baadhi ya bidhaa, tuma oda, kisha tuma zilizobaki.</p>
          <button type="button" class="cart-send" disabled><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${label}</button>`;
      }
      return `<a class="cart-send" href="${esc(o.url)}" target="_blank" rel="noopener">
        <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${label}</a>`;
    }).join('');
    return `
      <div class="cart-total"><span>Jumla</span><strong>TZS ${money(WM.cart.total())}</strong></div>
      ${many ? '<p class="cart-note">Bidhaa zako zinatoka kwa wauzaji tofauti, kwa hiyo kila muuzaji anapata oda yake.</p>' : ''}
      <div class="cart-sends">${buttons}</div>
      <p class="cart-note"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        Malipo na usafirishaji ni kati yako na muuzaji. Kagua bidhaa kabla ya kulipa.</p>
      <button type="button" class="cart-clear" data-cart-clear>
        <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Futa cart</button>`;
  }

  return { mount, open, close, update };
})();
