/* ================================================================
   WINGA MSOMI — main.js
   Page behaviour shared by all pages + the home page product grid.
   Header behaviour (search, dropdown, mobile menu) is in header.js.
   Needs: data/*.js, whatsapp.js, render.js, store.js
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── DATA: check data, fill links/numbers, render home pieces ── */
  // Must run first: later code binds to what is rendered here.
  WM.catalog.validate();
  WM.render.contactLinks();
  WM.render.counts();
  const pgrid = document.getElementById('pgrid');
  const catBar = document.querySelector('.cat-bar');
  const heroEl = document.getElementById('heroGrid');
  const benefitsEl = document.getElementById('benefits');
  const catCardsEl = document.getElementById('catCards');
  if (heroEl) WM.render.hero(heroEl);
  if (benefitsEl) WM.render.benefits(benefitsEl);
  if (catCardsEl) WM.render.catCards(catCardsEl);
  if (catBar) WM.render.catBar(catBar);
  if (pgrid) WM.render.grid(pgrid, WM.catalog.visible());
  WM.cartUI.mount(); // cart drawer, header badge, "Ongeza kwenye Cart" buttons

  const header = document.getElementById('navbar');
  const headerOffset = () => (header ? header.offsetHeight : 0) + 12;
  const scrollToEl = el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerOffset(), behavior: 'smooth' });

  /* ── ACTIVE NAV LINK ON SCROLL (home page) ───────────────────── */
  const navLinks = document.querySelectorAll('.hd-links > li > a[href^="#"]');
  function setActiveLink() {
    const y = window.scrollY + headerOffset() + 40;
    let current = null;
    document.querySelectorAll('main section[id], footer[id]').forEach(sec => {
      const top = sec.getBoundingClientRect().top + window.scrollY;
      if (y >= top) current = sec.id;
    });
    navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${current}`));
  }
  if (navLinks.length) {
    window.addEventListener('scroll', setActiveLink, { passive: true });
    setActiveLink();
  }

  /* ── PRODUCT GRID: category filter, search, sort (home page) ─── */
  if (pgrid) {
    const catBtns = document.querySelectorAll('.cat-btn');
    const cards = Array.from(pgrid.querySelectorAll('.pcard'));
    const productSearch = document.getElementById('productSearch');
    const productSort = document.getElementById('productSort');
    const productCount = document.getElementById('productCount');
    const emptyProducts = document.createElement('div');
    emptyProducts.className = 'empty-products';
    emptyProducts.innerHTML = `
      <i class="fa-solid fa-headset" aria-hidden="true"></i>
      <strong>Hujaiona bidhaa unayoitaka?</strong>
      <span>Tutajie bidhaa hiyo WhatsApp, tutakusaidia kuipata.</span>
      <a class="empty-chat-link" href="${WM.wa.requestLink()}" target="_blank" rel="noopener">
        Omba bidhaa WhatsApp
      </a>`;
    pgrid.appendChild(emptyProducts);

    cards.forEach((card, index) => {
      const p = WM.catalog.product(card.dataset.id) || {};
      card.dataset.index = index;
      card.dataset.name = String(p.name || '').toLowerCase();
      card.dataset.description = String(p.description || '').toLowerCase();
      card.dataset.price = p.price || 0;
    });

    const activeCategory = () => document.querySelector('.cat-btn.active')?.dataset.cat || 'all';

    function applyProductView() {
      const cat = activeCategory();
      const query = productSearch?.value.trim().toLowerCase() || '';
      const sortBy = productSort?.value || 'featured';
      let shown = 0;

      cards.forEach(card => {
        const matchesCategory = cat === 'all' || card.dataset.cat === cat;
        const haystack = `${card.dataset.name} ${card.dataset.description} ${card.dataset.cat}`;
        const isVisible = matchesCategory && (!query || haystack.includes(query));
        card.classList.toggle('hidden', !isVisible);
        if (isVisible) shown++;
      });

      [...cards].sort((a, b) => {
        if (sortBy === 'name-asc') return a.dataset.name.localeCompare(b.dataset.name);
        if (sortBy === 'price-asc') return a.dataset.price - b.dataset.price;
        if (sortBy === 'price-desc') return b.dataset.price - a.dataset.price;
        return a.dataset.index - b.dataset.index;
      }).forEach(card => pgrid.insertBefore(card, emptyProducts));

      emptyProducts.classList.toggle('visible', shown === 0);
      if (productCount) productCount.textContent = `${shown} bidhaa zinaonekana`;
      emptyProducts.querySelector('.empty-chat-link').href = WM.wa.requestLink(productSearch?.value.trim());
    }

    catBtns.forEach(btn => btn.addEventListener('click', () => {
      catBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      applyProductView();
    }));
    catBtns.forEach(b => b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false'));

    productSearch?.addEventListener('input', applyProductView);
    productSort?.addEventListener('change', applyProductView);

    // index.html?q=... (search from another page) fills the product search
    const q = new URLSearchParams(location.search).get('q');
    if (q && productSearch) productSearch.value = q;
    applyProductView();

    /* #cat=<key> links select that category and scroll to the grid */
    function showCategory(key) {
      const btn = document.querySelector(`.cat-btn[data-cat="${key}"]`);
      if (!btn) return;
      if (productSearch) productSearch.value = '';
      btn.click();
      scrollToEl(document.getElementById('products'));
    }
    const hashCat = () => (location.hash.match(/^#cat=([\w-]+)/) || [])[1];
    // Handle clicks ourselves so clicking the same category twice still works
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#cat="]');
      if (!a) return;
      e.preventDefault();
      const key = a.getAttribute('href').slice(5);
      history.replaceState(null, '', `#cat=${key}`);
      showCategory(key);
    });
    window.addEventListener('hashchange', () => { if (hashCat()) showCategory(hashCat()); });
    if (hashCat()) setTimeout(() => showCategory(hashCat()), 60);
    else if (q || location.hash === '#products') setTimeout(() => scrollToEl(document.getElementById('products')), 60);
  }

  /* ── IMAGE SHIMMER + FALLBACK ────────────────────────────────── */
  document.querySelectorAll('.pcard-img img').forEach(img => {
    const shimmer = img.previousElementSibling;
    const done = () => shimmer && shimmer.classList.add('done');
    if (img.complete && img.naturalWidth > 0) { done(); return; }
    img.addEventListener('load', done);
    img.addEventListener('error', () => {
      // Fallback: gradient placeholder with the category icon
      done();
      const wrap = img.parentElement;
      img.style.display = 'none';
      const fb = document.createElement('div');
      fb.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#2d2d4e);gap:10px;';
      const cat = WM.catalog.category(wrap.closest('.pcard')?.dataset.cat);
      // Built with DOM APIs (no HTML strings): safe and allowed by the CSP
      const ic = document.createElement('i');
      ic.className = (cat && cat.icon) || 'fa-solid fa-box-open';
      ic.setAttribute('aria-hidden', 'true');
      ic.style.cssText = 'font-size:3rem;color:rgba(255,255,255,.25)';
      const tx = document.createElement('span');
      tx.textContent = 'Picha Inakuja';
      tx.style.cssText = 'color:rgba(255,255,255,.3);font-size:.75rem;font-weight:600';
      fb.append(ic, tx);
      wrap.appendChild(fb);
    });
  });

  /* ── REVEAL ON SCROLL ────────────────────────────────────────── */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); revObs.unobserve(entry.target); }
      });
    }, { threshold: 0.1 });
    reveals.forEach(el => revObs.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  /* ── SMOOTH SCROLL for same-page "#section" links (delegated) ── */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.length < 2 || href.includes('=')) return; // "#" and "#cat=..." handled elsewhere
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    history.replaceState(null, '', href);
    scrollToEl(target);
  });

  /* ── FLOATING BUTTON NEVER COVERS ANYTHING ───────────────────────
     While the "Omba bidhaa / Uliza" button sits over a link, button,
     input, product card or the cart toast, it fades out; it comes back
     as soon as the space under it is clear. offsetLeft/Top ignore the
     fade transform, so the check always uses the button's real place. */
  const flt = document.querySelector('.flt-chat');
  if (flt) {
    const GAP = 8; // keep a little air around the button
    const targets = 'main a[href], main button, main input, main select, main .pcard, footer a[href], .wm-toast.show';
    let ticking = false;
    const check = () => {
      ticking = false;
      const box = {
        left: flt.offsetLeft - GAP, top: flt.offsetTop - GAP,
        right: flt.offsetLeft + flt.offsetWidth + GAP, bottom: flt.offsetTop + flt.offsetHeight + GAP
      };
      if (!flt.offsetWidth) return; // hidden (e.g. cart drawer open)
      const covered = [...document.querySelectorAll(targets)].some(el => {
        if (el.closest('[hidden]')) return false;
        const r = el.getBoundingClientRect();
        return r.width && r.height && r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top;
      });
      flt.classList.toggle('flt-away', covered);
    };
    const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
    ['scroll', 'resize'].forEach(ev => window.addEventListener(ev, queue, { passive: true }));
    window.addEventListener('wm:cart', () => { queue(); setTimeout(queue, 350); setTimeout(queue, 3900); }); // toast in/out
    queue();
  }

  /* ── COPY BUTTONS (Support number) ───────────────────────────── */
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = (WM.site.support || {})[btn.dataset.copy] || '';
      const label = btn.innerHTML;
      let ok = false;
      try { await navigator.clipboard.writeText(text.replace(/\s/g, '')); ok = true; } catch (e) {
        // Fallback for older browsers / blocked clipboard
        const t = document.createElement('textarea');
        t.value = text.replace(/\s/g, '');
        t.setAttribute('readonly', '');
        t.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(t);
        t.select();
        try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
        t.remove();
      }
      btn.innerHTML = ok ? '<i class="fa-solid fa-check" aria-hidden="true"></i> Imenakiliwa' : 'Nakili mwenyewe';
      setTimeout(() => { btn.innerHTML = label; }, 2000);
    });
  });
});
