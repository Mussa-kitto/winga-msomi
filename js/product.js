/* ================================================================
   WINGA MSOMI — product.js
   Draws product.html?id=<slug> from js/data. Runs before main.js
   (both on DOMContentLoaded) so main.js can bind to what we render.
   Needs: data/*.js, whatsapp.js, render.js, store.js
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('product');
  if (!root) return;

  const esc = WM.render.esc;
  const money = WM.wa.money;
  const id = new URLSearchParams(location.search).get('id') || '';
  const p = WM.catalog.product(id);

  // Unknown id, hidden product, or inactive seller -> friendly message
  if (!p || !WM.catalog.isVisible(p)) {
    document.title = 'Bidhaa haipatikani | WINGA MSOMI';
    root.innerHTML = `
      <section class="pd-missing">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
        <h1>Bidhaa haipatikani</h1>
        <p>Huenda bidhaa hii imeondolewa au kiungo si sahihi. Angalia bidhaa nyingine zilizopo.</p>
        <div class="pd-missing-btns">
          <a href="index.html#products" class="pd-btn pd-btn-blue"><i class="fa-solid fa-shop" aria-hidden="true"></i> Rudi kwenye bidhaa</a>
          <a href="${esc(WM.wa.requestLink(id.replace(/-/g, ' ')))}" class="pd-btn pd-btn-outline" target="_blank" rel="noopener">
            <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Omba bidhaa hii</a>
        </div>
      </section>`;
    return;
  }

  const cat = WM.catalog.category(p.category) || { label: p.category, fullLabel: p.category };
  const seller = WM.catalog.seller(p.sellerId);
  const sold = p.status !== 'available';
  const images = p.images.length ? p.images : [''];
  const sellerCount = WM.catalog.visible().filter(x => x.sellerId === seller.id).length;
  const discount = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  document.title = `${p.name} — TZS ${money(p.price)} | WINGA MSOMI`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `${p.name}: ${p.description}`);

  // Specs table: real product specs (if any) + facts we know from the data
  const facts = [
    ...(p.specs || []).map(s => (typeof s === 'string' ? s.split(/:(.+)/).slice(0, 2) : [s.label, s.value])),
    ['Hali', p.condition || 'Uliza muuzaji'],
    ['Aina', cat.fullLabel || cat.label],
    ['Muuzaji', seller.name]
  ];

  root.innerHTML = `
    <nav class="pd-crumbs" aria-label="Breadcrumb">
      <ol>
        <li><a href="index.html">Nyumbani</a></li>
        <li><a href="index.html#cat=${esc(p.category)}">${esc(cat.label)}</a></li>
        <li aria-current="page">${esc(p.name)}</li>
      </ol>
    </nav>

    <section class="pd-main">
      <!-- Gallery -->
      <div class="pd-gallery">
        <div class="pd-stage" id="pdStage">
          <img id="pdImg" src="${esc(images[0])}" alt="${esc(p.alt || p.name)}" width="800" height="600"/>
          ${WM.render.badgeHtml(p)}
          ${images.length > 1 ? `
            <button type="button" class="pd-nav prev" aria-label="Picha iliyopita"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <button type="button" class="pd-nav next" aria-label="Picha inayofuata"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
            <span class="pd-counter" aria-hidden="true"><span id="pdIdx">1</span>/${images.length}</span>` : ''}
        </div>
        ${images.length > 1 ? `
        <div class="pd-thumbs" role="group" aria-label="Picha za bidhaa">
          ${images.map((src, i) => `
            <button type="button" class="pd-thumb${i ? '' : ' active'}" data-i="${i}" aria-label="Picha ya ${i + 1}" aria-pressed="${i ? 'false' : 'true'}">
              <img src="${esc(src)}" alt="" width="72" height="72" loading="lazy"/>
            </button>`).join('')}
        </div>` : ''}
      </div>

      <!-- Info + actions -->
      <div class="pd-info">
        <a class="pd-cat" href="index.html#cat=${esc(p.category)}"><i class="${esc(cat.icon || 'fa-solid fa-tag')}" aria-hidden="true"></i> ${esc(cat.fullLabel || cat.label)}</a>
        <h1 class="pd-name">${esc(p.name)}</h1>

        <div class="pd-price">
          <strong><span class="cur">TZS</span> ${money(p.price)}</strong>
          ${discount ? `<s>TZS ${money(p.oldPrice)}</s><span class="pd-off">-${discount}%</span>` : ''}
        </div>

        <ul class="pd-meta">
          <li><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Hali: <strong>${esc(p.condition || 'Uliza muuzaji')}</strong></li>
          <li class="${sold ? 'is-sold' : 'is-ok'}"><i class="fa-solid ${sold ? 'fa-circle-xmark' : 'fa-box'}" aria-hidden="true"></i>
            ${sold ? '<strong>Imeuzwa</strong>' : '<strong>Inapatikana</strong>'}</li>
        </ul>

        <p class="pd-desc">${esc(p.description)}</p>

        ${(p.specs || []).length ? `
        <ul class="pd-specs-short">
          ${facts.slice(0, Math.min(4, p.specs.length)).map(([k, v]) => `<li><span>${esc(k)}</span> ${esc(v)}</li>`).join('')}
        </ul>` : ''}

        ${sold ? `
          <p class="pd-sold-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Bidhaa hii imeuzwa. Uliza muuzaji kama itarudi tena.</p>
          <div class="pd-actions">
            <a class="pd-btn pd-btn-outline" href="${esc(WM.wa.productChatLink(p))}" target="_blank" rel="noopener">
              <i class="fa-regular fa-comments" aria-hidden="true"></i> Chat na Muuzaji</a>
          </div>` : `
          <div class="pd-qty-row">
            <label for="pdQty">Idadi</label>
            <div class="qty qty-lg">
              <button type="button" id="pdDec" aria-label="Punguza idadi"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
              <input type="number" id="pdQty" inputmode="numeric" min="1" max="${WM.cart.MAX_QTY}" value="1"/>
              <button type="button" id="pdInc" aria-label="Ongeza idadi"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            </div>
            <span class="pd-qty-total" id="pdQtyTotal" aria-live="polite"></span>
          </div>

          <div class="pd-actions">
            <button type="button" class="pd-btn pd-btn-orange" data-add-cart="${esc(p.id)}" data-qty-input="#pdQty">
              <i class="fa-solid fa-cart-plus" aria-hidden="true"></i> Ongeza kwenye Cart</button>
            <a class="pd-btn pd-btn-green" id="pdOrder" href="#" target="_blank" rel="noopener">
              <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Agiza Sasa</a>
            <a class="pd-btn pd-btn-outline" href="${esc(WM.wa.productChatLink(p))}" target="_blank" rel="noopener">
              <i class="fa-regular fa-comments" aria-hidden="true"></i> Chat na Muuzaji</a>
          </div>`}

        <p class="pd-safety"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          Kagua bidhaa kabla ya kulipa. Winga Msomi haishughulikii malipo wala usafirishaji.</p>

        <!-- Seller card -->
        <div class="pd-seller">
          <div class="pd-seller-avatar" aria-hidden="true">${esc(seller.name.charAt(0))}</div>
          <div class="pd-seller-info">
            <strong>${esc(seller.name)}</strong>
            <span><i class="fa-solid fa-user-graduate" aria-hidden="true"></i> ${esc(seller.about || 'Muuzaji mwanafunzi wa UDOM')}</span>
            <span><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc(seller.area || 'UDOM, Dodoma')}</span>
            <span><i class="fa-solid fa-box-open" aria-hidden="true"></i> Bidhaa ${sellerCount} kwenye Winga Msomi</span>
          </div>
          <a class="pd-seller-chat" href="${esc(WM.wa.productChatLink(p))}" target="_blank" rel="noopener" aria-label="Chat na ${esc(seller.name)} kwenye WhatsApp">
            <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Chat</a>
        </div>
      </div>
    </section>

    <!-- Tabs: Maelezo / Vipimo / Jinsi ya Kuagiza -->
    <section class="pd-tabs">
      <div class="pd-tablist" role="tablist" aria-label="Maelezo ya bidhaa">
        <button type="button" role="tab" id="tab-desc" aria-controls="panel-desc" aria-selected="true">Maelezo</button>
        <button type="button" role="tab" id="tab-specs" aria-controls="panel-specs" aria-selected="false" tabindex="-1">Vipimo / Specs</button>
        <button type="button" role="tab" id="tab-how" aria-controls="panel-how" aria-selected="false" tabindex="-1">Jinsi ya Kuagiza</button>
      </div>

      <div class="pd-panel" role="tabpanel" id="panel-desc" aria-labelledby="tab-desc" tabindex="0">
        <p>${esc(p.description)}</p>
        ${p.orderNote ? `<p class="pd-panel-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Ukiagiza: ${esc(p.orderNote.replace(/^\(|\)$/g, ''))}.</p>` : ''}
      </div>

      <div class="pd-panel" role="tabpanel" id="panel-specs" aria-labelledby="tab-specs" tabindex="0" hidden>
        <table class="pd-spec-table">
          <tbody>
            ${facts.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
          </tbody>
        </table>
        ${(p.specs || []).length ? '' : '<p class="pd-panel-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Muuzaji hajaweka vipimo zaidi. Uliza kupitia "Chat na Muuzaji" kwa maelezo zaidi.</p>'}
      </div>

      <div class="pd-panel" role="tabpanel" id="panel-how" aria-labelledby="tab-how" tabindex="0" hidden>
        <ol class="pd-steps">
          <li><strong>Chagua bidhaa</strong> na idadi unayotaka. Unaweza kuongeza bidhaa kadhaa kwenye cart.</li>
          <li><strong>Wasiliana na muuzaji WhatsApp</strong> kwa kubonyeza "Agiza Sasa" au "Tuma Oda" kwenye cart.</li>
          <li><strong>Kubaliana bei, malipo na kupokea bidhaa</strong> moja kwa moja na muuzaji.</li>
        </ol>
        <p class="pd-panel-note"><i class="fa-solid fa-handshake" aria-hidden="true"></i>
          Winga Msomi inawaunganisha wanunuzi na wauzaji wanafunzi. Malipo na usafirishaji ni kati ya mnunuzi na muuzaji.</p>
      </div>
    </section>

    <!-- Similar products -->
    <section class="pd-similar" aria-labelledby="similarTitle">
      <h2 id="similarTitle">Bidhaa Zinazofanana</h2>
      <div class="pgrid" id="similarGrid"></div>
    </section>

    ${sold ? '' : `
    <!-- Mobile sticky action bar -->
    <div class="pd-sticky" role="region" aria-label="Agiza bidhaa hii">
      <div class="pd-sticky-price"><span>TZS</span> ${money(p.price)}</div>
      <a class="pd-sticky-chat" href="${esc(WM.wa.productChatLink(p))}" target="_blank" rel="noopener" aria-label="Chat na muuzaji">
        <i class="fa-regular fa-comments" aria-hidden="true"></i> Chat</a>
      <a class="pd-sticky-order" id="pdOrderSticky" href="#" target="_blank" rel="noopener">
        <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Agiza Sasa</a>
    </div>`}`;

  /* ── Similar: up to 4 from the same category, topped up from others ── */
  const others = WM.catalog.visible().filter(x => x.id !== p.id);
  const similar = [...others.filter(x => x.category === p.category), ...others.filter(x => x.category !== p.category)].slice(0, 4);
  WM.render.grid(document.getElementById('similarGrid'), similar);

  /* ── Gallery: thumbnails, arrows, swipe, hover zoom ── */
  const img = document.getElementById('pdImg');
  const stage = document.getElementById('pdStage');
  let current = 0;
  function show(i) {
    current = (i + images.length) % images.length;
    img.src = images[current];
    document.querySelectorAll('.pd-thumb').forEach((t, n) => {
      t.classList.toggle('active', n === current);
      t.setAttribute('aria-pressed', n === current ? 'true' : 'false');
    });
    const idx = document.getElementById('pdIdx');
    if (idx) idx.textContent = current + 1;
  }
  root.querySelectorAll('.pd-thumb').forEach(t => t.addEventListener('click', () => show(+t.dataset.i)));
  root.querySelector('.pd-nav.prev')?.addEventListener('click', () => show(current - 1));
  root.querySelector('.pd-nav.next')?.addEventListener('click', () => show(current + 1));

  let touchX = null;
  stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (touchX === null || images.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  // Desktop hover zoom (mouse only)
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stage.addEventListener('mousemove', e => {
      const r = stage.getBoundingClientRect();
      img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      stage.classList.add('zoom');
    });
    stage.addEventListener('mouseleave', () => stage.classList.remove('zoom'));
  }

  /* ── Quantity -> "Agiza Sasa" links ── */
  const qtyInput = document.getElementById('pdQty');
  if (qtyInput) {
    const clamp = v => Math.max(1, Math.min(WM.cart.MAX_QTY, parseInt(v, 10) || 1));
    const sync = () => {
      const q = clamp(qtyInput.value);
      qtyInput.value = q;
      const href = WM.wa.productOrderLink(p, q);
      document.getElementById('pdOrder').href = href;
      const sticky = document.getElementById('pdOrderSticky');
      if (sticky) sticky.href = href;
      document.getElementById('pdDec').disabled = q <= 1;
      document.getElementById('pdInc').disabled = q >= WM.cart.MAX_QTY;
      document.getElementById('pdQtyTotal').textContent = q > 1 ? `Jumla: TZS ${money(p.price * q)}` : '';
    };
    document.getElementById('pdDec').addEventListener('click', () => { qtyInput.value = clamp(qtyInput.value) - 1; sync(); });
    document.getElementById('pdInc').addEventListener('click', () => { qtyInput.value = clamp(qtyInput.value) + 1; sync(); });
    qtyInput.addEventListener('change', sync);
    qtyInput.addEventListener('input', () => { if (qtyInput.value !== '') sync(); });
    sync();
  }

  /* ── Tabs (arrow keys move between tabs) ── */
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function selectTab(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') { e.preventDefault(); selectTab(tabs[0], true); }
      else if (e.key === 'End') { e.preventDefault(); selectTab(tabs[tabs.length - 1], true); }
      else if (step) { e.preventDefault(); selectTab(tabs[(i + step + tabs.length) % tabs.length], true); }
    });
  });

  if (!sold) document.body.classList.add('has-sticky');
});
