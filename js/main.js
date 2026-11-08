/* ================================================================
   WINGA MSOMI — main.js
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── DATA: check data, fill WhatsApp links, render products ──── */
  // Must run first: later code binds to the rendered cards/buttons/links.
  WM.catalog.validate();
  WM.render.contactLinks();
  const pgrid = document.getElementById('pgrid');
  const catBar = document.querySelector('.cat-bar');
  if (catBar) WM.render.catBar(catBar);
  if (pgrid) WM.render.grid(pgrid, WM.catalog.visible());

  /* ── HAMBURGER MENU ──────────────────────────────────────────── */
  const ham     = document.getElementById('ham');
  const mobMenu = document.getElementById('mobMenu');

  ham.addEventListener('click', () => {
    const isOpen = mobMenu.classList.toggle('open');
    ham.classList.toggle('open', isOpen);
    ham.setAttribute('aria-expanded', isOpen);
  });

  // Close on link click
  mobMenu.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      mobMenu.classList.remove('open');
      ham.classList.remove('open');
      ham.setAttribute('aria-expanded', 'false');
    })
  );

  /* ── ACTIVE NAV LINK ON SCROLL ───────────────────────────────── */
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  function setActiveLink() {
    const scrollY = window.scrollY + 120;
    document.querySelectorAll('section[id], footer[id]').forEach(sec => {
      if (scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight) {
        navLinks.forEach(l => l.classList.remove('active'));
        const match = document.querySelector(`.nav-links a[href="#${sec.id}"]`);
        if (match) match.classList.add('active');
      }
    });
  }
  window.addEventListener('scroll', setActiveLink, { passive: true });
  setActiveLink();

  /* ── CATEGORY FILTER ─────────────────────────────────────────── */
  const catBtns = document.querySelectorAll('.cat-btn');
  const cards   = Array.from(document.querySelectorAll('.pcard'));
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
      Chat with us
    </a>
  `;
  pgrid.appendChild(emptyProducts);

  cards.forEach((card, index) => {
    card.dataset.index = index;
    card.dataset.name = card.querySelector('.pname')?.textContent.trim().toLowerCase() || '';
    card.dataset.description = card.querySelector('.pdesc')?.textContent.trim().toLowerCase() || '';
    card.dataset.price = (card.querySelector('.pprice')?.textContent || '').replace(/[^\d]/g, '') || '0';
  });

  function activeCategory() {
    return document.querySelector('.cat-btn.active')?.dataset.cat || 'all';
  }

  function applyProductView() {
    const cat = activeCategory();
    const query = productSearch?.value.trim().toLowerCase() || '';
    const sortBy = productSort?.value || 'featured';
    let shown = 0;

    cards.forEach(card => {
      const matchesCategory = cat === 'all' || card.dataset.cat === cat;
      const haystack = `${card.dataset.name} ${card.dataset.description} ${card.dataset.cat}`;
      const matchesSearch = !query || haystack.includes(query);
      const isVisible = matchesCategory && matchesSearch;

      card.classList.toggle('hidden', !isVisible);
      if (isVisible) shown++;
    });

    const sortedCards = [...cards].sort((a, b) => {
      if (sortBy === 'name-asc') return a.dataset.name.localeCompare(b.dataset.name);
      if (sortBy === 'price-asc') return Number(a.dataset.price) - Number(b.dataset.price);
      if (sortBy === 'price-desc') return Number(b.dataset.price) - Number(a.dataset.price);
      return Number(a.dataset.index) - Number(b.dataset.index);
    });

    sortedCards.forEach(card => pgrid.insertBefore(card, emptyProducts));
    emptyProducts.classList.toggle('visible', shown === 0);

    if (productCount) {
      productCount.textContent = `${shown} bidhaa zinaonekana`;
    }

    const emptyChatLink = emptyProducts.querySelector('.empty-chat-link');
    if (emptyChatLink) {
      emptyChatLink.href = WM.wa.requestLink(productSearch?.value.trim());
    }
  }

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyProductView();
    });
  });

  productSearch?.addEventListener('input', applyProductView);
  productSort?.addEventListener('change', applyProductView);
  applyProductView();

  /* ── IMAGE LAZY LOAD + SHIMMER ───────────────────────────────── */
  const imgs = document.querySelectorAll('.pcard-img img');

  imgs.forEach(img => {
    const shimmer = img.previousElementSibling;

    if (img.complete && img.naturalWidth > 0) {
      if (shimmer) shimmer.classList.add('done');
    } else {
      img.addEventListener('load', () => {
        if (shimmer) shimmer.classList.add('done');
      });
      img.addEventListener('error', () => {
        // Fallback: replace with gradient placeholder
        if (shimmer) shimmer.classList.add('done');
        const wrap = img.parentElement;
        img.style.display = 'none';
        const fb = document.createElement('div');
        fb.style.cssText = `
          position:absolute;inset:0;display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          background:linear-gradient(135deg,#1a1a2e,#2d2d4e);
          gap:10px;
        `;
        const ic = document.createElement('i');
        // use the product category icon
        const cat = WM.catalog.category(wrap.closest('.pcard')?.dataset.cat);
        ic.className = (cat && cat.icon) || 'fa-solid fa-box-open';
        ic.style.cssText = 'font-size:3rem;color:rgba(255,255,255,.25);';
        const txt = document.createElement('span');
        txt.textContent = 'Picha Inakuja';
        txt.style.cssText = 'color:rgba(255,255,255,.3);font-size:.75rem;font-weight:600;';
        fb.appendChild(ic);
        fb.appendChild(txt);
        wrap.appendChild(fb);
      });
    }
  });

  /* ── REVEAL ON SCROLL (IntersectionObserver) ─────────────────── */
  const reveals = document.querySelectorAll('.reveal');
  const revObs  = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => revObs.observe(el));

  /* ── COUNTER ANIMATION (hero stats) ─────────────────────────── */
  const counters = document.querySelectorAll('.hstat strong[data-count]');
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      let current  = 0;
      const step   = Math.ceil(target / 60);
      const timer  = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current + suffix;
        if (current >= target) clearInterval(timer);
      }, 18);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(el => counterObs.observe(el));

  /* ── SMOOTH SCROLL for anchor links ─────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href.length < 2) return; // plain "#" links
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const offset = document.getElementById('navbar').offsetHeight + 12;
      window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
    });
  });

  /* ── NAVBAR SHADOW ON SCROLL ─────────────────────────────────── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.scrollY > 10
      ? '0 4px 24px rgba(26,86,219,.13)'
      : '0 2px 16px rgba(26,86,219,.07)';
  }, { passive: true });

});
