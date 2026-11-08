/* ================================================================
   WINGA MSOMI — admin.js  (admin/index.html)
   Owner-only editor for products, photos and sellers.
   - Talks ONLY to api.github.com with the owner's token.
   - Every save = one commit (photos + data file together), made on top
     of the latest version, so Vercel redeploys once per save.
   - The token is kept in this browser only (localStorage if
     "Nikumbuke" is ticked, otherwise sessionStorage).
   ================================================================ */
(function () {
  'use strict';

  const DEFAULTS = { repo: 'Mussa-kitto/winga-msomi', branch: 'main' };
  const FILES = { products: 'js/data/products.js', sellers: 'js/data/sellers.js', categories: 'js/data/categories.js' };
  const KEY_CFG = 'wm-admin-cfg', KEY_TOKEN = 'wm-admin-token';
  const MAX_SIDE = 1000, JPEG_QUALITY = 0.82;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Number(n || 0).toLocaleString('en-US');
  const slug = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/"/g, ' inch')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const today = () => new Date().toISOString().slice(0, 10);

  /* ── Browser storage (always wrapped: storage can be blocked) ── */
  const storage = {
    get(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v, remember) {
      try { (remember ? localStorage : sessionStorage).setItem(k, v); (remember ? sessionStorage : localStorage).removeItem(k); } catch (e) { /* memory only */ }
    },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ── Base64 helpers (UTF-8 safe) ── */
  function bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const b64ToText = b64 => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, '')), c => c.charCodeAt(0)));
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');

  /* ================================================================
     GITHUB API
     ================================================================ */
  const gh = {
    token: '', owner: '', repo: '', branch: '',
    async req(method, path, body) {
      const res = await fetch(`https://api.github.com${path}`, {
        method,
        cache: 'no-store',
        headers: Object.assign({
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        let msg = res.statusText;
        try { msg = (await res.json()).message || msg; } catch (e) { /* not json */ }
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return res.status === 204 ? null : res.json();
    },
    r(p) { return `/repos/${this.owner}/${this.repo}${p}`; },
    headSha() { return this.req('GET', this.r(`/git/ref/heads/${encodeURIComponent(this.branch)}`)).then(x => x.object.sha); },
    async readText(path, ref) {
      const x = await this.req('GET', this.r(`/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`));
      return b64ToText(x.content);
    },
    uploadBlob(b64) { return this.req('POST', this.r('/git/blobs'), { content: b64, encoding: 'base64' }).then(x => x.sha); },

    /* One commit with several changes, always on top of the newest commit.
       build(head, paths) returns [{path, text} | {path, delete: true}] computed from the
       data at `head`; blobs = [{path, sha}] uploaded beforehand. Retries if the branch moved. */
    async commit(message, blobs, build) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const head = await this.headSha();
        const commit = await this.req('GET', this.r(`/git/commits/${head}`));
        const tree = await this.req('GET', this.r(`/git/trees/${commit.tree.sha}?recursive=1`));
        const paths = new Set(tree.tree.filter(t => t.type === 'blob').map(t => t.path));
        const changes = await build(head, paths);
        const entries = [
          ...blobs.map(b => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
          ...changes.filter(c => !c.delete).map(c => ({ path: c.path, mode: '100644', type: 'blob', content: c.text })),
          // Only delete files that really exist (GitHub rejects unknown paths)
          ...changes.filter(c => c.delete && paths.has(c.path)).map(c => ({ path: c.path, mode: '100644', type: 'blob', sha: null }))
        ];
        const newTree = await this.req('POST', this.r('/git/trees'), { base_tree: commit.tree.sha, tree: entries });
        const newCommit = await this.req('POST', this.r('/git/commits'), { message, tree: newTree.sha, parents: [head] });
        try {
          await this.req('PATCH', this.r(`/git/refs/heads/${encodeURIComponent(this.branch)}`), { sha: newCommit.sha, force: false });
          return newCommit;
        } catch (e) {
          if ((e.status === 422 || e.status === 409) && attempt < 2) continue; // branch moved: rebuild on the new head
          throw e;
        }
      }
      throw new Error('Imeshindikana kuhifadhi baada ya majaribio 3.');
    }
  };

  /* ================================================================
     DATA FILES (read js/data/*.js, write them back in the same style)
     ================================================================ */
  // Run a data file in a sandbox object and return WM.<key>
  function parseData(text, key) {
    const w = { WM: {} };
    new Function('window', 'WM', text)(w, w.WM); // eslint-disable-line no-new-func
    const value = w.WM[key];
    if (!Array.isArray(value)) throw new Error(`WM.${key} haikupatikana kwenye faili.`);
    return value;
  }

  // Same spacing as the existing files: {"a": 1, "b": ["x", "y"]}
  function fmt(v) {
    if (Array.isArray(v)) return `[${v.map(fmt).join(', ')}]`;
    if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${fmt(x)}`).join(', ')}}`;
    return JSON.stringify(v);
  }

  // Replace only the array; the comment header at the top is kept
  function writeArray(text, key, items) {
    const marker = `WM.${key} = [`;
    const i = text.indexOf(marker);
    if (i < 0) throw new Error(`Muundo wa faili haujulikani (${marker}).`);
    return `${text.slice(0, i + marker.length)}\n${items.map(x => `  ${fmt(x)}`).join(',\n')}\n];\n`;
  }

  const PRODUCT_KEYS = ['id', 'sellerId', 'name', 'category', 'price', 'oldPrice', 'description', 'specs', 'images', 'alt',
    'condition', 'status', 'badge', 'icon', 'orderNote', 'addedOn'];
  const OPTIONAL = ['oldPrice', 'badge', 'orderNote'];
  function cleanProduct(p) {
    const o = {};
    PRODUCT_KEYS.forEach(k => {
      const v = p[k];
      if (OPTIONAL.includes(k) && (v === undefined || v === null || v === '' || v === 0)) return;
      if (v !== undefined) o[k] = v;
    });
    Object.keys(p).forEach(k => { if (!PRODUCT_KEYS.includes(k) && p[k] !== undefined) o[k] = p[k]; }); // keep unknown fields
    return o;
  }
  const SELLER_KEYS = ['id', 'name', 'whatsapp', 'area', 'about', 'active'];
  function cleanSeller(s) {
    const o = {};
    SELLER_KEYS.forEach(k => { if (s[k] !== undefined) o[k] = s[k]; });
    Object.keys(s).forEach(k => { if (!SELLER_KEYS.includes(k)) o[k] = s[k]; });
    return o;
  }

  /* ================================================================
     STATE
     ================================================================ */
  const state = { products: [], sellers: [], categories: [], head: '', isPrivate: false };

  async function loadAll() {
    const head = await gh.headSha();
    const [p, s, c] = await Promise.all([FILES.products, FILES.sellers, FILES.categories].map(f => gh.readText(f, head)));
    state.products = parseData(p, 'products');
    state.sellers = parseData(s, 'sellers');
    state.categories = parseData(c, 'categories');
    state.head = head;
    renderProducts();
    renderSellers();
  }

  // Image src: the deployed file, or GitHub (raw) for photos not deployed yet
  function imgSrc(path) { return `../${path.split('/').map(encodeURIComponent).join('/')}`; }
  function rawSrc(path) { return `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${encodeURIComponent(gh.branch)}/${encPath(path)}`; }
  window.wmAdminImgFallback = img => {
    if (!img.dataset.fallback && !state.isPrivate) { img.dataset.fallback = '1'; img.src = rawSrc(img.dataset.path); }
  };
  const imgTag = (path, cls) => `<img class="${cls || ''}" src="${esc(imgSrc(path))}" data-path="${esc(path)}" alt="" loading="lazy" width="64" height="64" onerror="wmAdminImgFallback(this)"/>`;

  /* ================================================================
     UI HELPERS
     ================================================================ */
  let toastTimer;
  function toast(html, kind, sticky) {
    const t = $('#admToast');
    t.className = `adm-toast ${kind || ''}`;
    t.innerHTML = html;
    t.hidden = false;
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
  }
  const busy = text => toast(`<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ${esc(text)}`, '', true);
  function done(commit) {
    const url = commit && (commit.html_url || `https://github.com/${gh.owner}/${gh.repo}/commit/${commit.sha}`);
    toast(`<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Imehifadhiwa! Tovuti itasasishwa ndani ya dakika 1–2.
      ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Ona kwenye GitHub</a>` : ''}`, 'ok');
  }
  function fail(e) {
    let msg = e && e.message ? e.message : String(e);
    if (e && e.status === 401) msg = 'Token si sahihi au imeisha muda. Toka kisha uingie tena na token mpya.';
    if (e && e.status === 403) msg = 'Token haina ruhusa ya kuandika (Contents: Read and write) kwenye repository hii.';
    if (e && e.status === 404) msg = 'Haikupatikana. Hakikisha repository, branch na token ni sahihi.';
    toast(`<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${esc(msg)}`, 'bad', true);
  }

  // Simple modal handling (focus inside, Esc closes, focus returns)
  let lastFocus = null;
  function openSheet(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.classList.add('adm-locked');
    setTimeout(() => (el.querySelector('input:not([type=file]), select, textarea, button') || el).focus(), 30);
  }
  function closeSheet(el) {
    el.hidden = true;
    if (![...document.querySelectorAll('.adm-sheet')].some(s => !s.hidden)) document.body.classList.remove('adm-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', e => {
    const open = [...document.querySelectorAll('.adm-sheet')].filter(s => !s.hidden).pop();
    if (!open) return;
    if (e.key === 'Escape') { if (open.id === 'confirmBox') $('#cfNo').click(); else closeSheet(open); }
    if (e.key === 'Tab') {
      const f = [...open.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]), select, textarea')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.querySelectorAll('.adm-sheet [data-close]').forEach(b => b.addEventListener('click', () => closeSheet(b.closest('.adm-sheet'))));

  // Confirm dialog -> Promise<{ok, opt}>
  function confirmBox(title, text, optText) {
    return new Promise(resolve => {
      const box = $('#confirmBox');
      $('#cfTitle').textContent = title;
      $('#cfText').textContent = text;
      $('#cfOptWrap').hidden = !optText;
      $('#cfOptText').textContent = optText || '';
      $('#cfOpt').checked = true;
      const finish = ok => { $('#cfYes').onclick = $('#cfNo').onclick = null; closeSheet(box); resolve({ ok, opt: $('#cfOpt').checked }); };
      $('#cfYes').onclick = () => finish(true);
      $('#cfNo').onclick = () => finish(false);
      openSheet(box);
      setTimeout(() => $('#cfNo').focus(), 40);
    });
  }

  /* ================================================================
     PRODUCTS LIST
     ================================================================ */
  const STATUS = { available: ['Inapatikana', 'ok'], sold: ['Imeuzwa', 'sold'], hidden: ['Imefichwa', 'hid'] };

  function renderProducts() {
    const q = $('#productSearch').value.trim().toLowerCase();
    const st = $('#statusFilter').value;
    const list = state.products.filter(p =>
      (!st || p.status === st) &&
      (!q || `${p.name} ${p.id} ${p.description}`.toLowerCase().includes(q)));
    $('#countProducts').textContent = state.products.length;
    $('#productList').innerHTML = list.length ? list.map(p => {
      const cat = state.categories.find(c => c.key === p.category);
      const seller = state.sellers.find(s => s.id === p.sellerId);
      const [label, cls] = STATUS[p.status] || [p.status, ''];
      return `
        <li class="adm-item">
          ${p.images && p.images[0] ? imgTag(p.images[0], 'adm-thumb') : '<span class="adm-thumb adm-thumb-empty"><i class="fa-regular fa-image"></i></span>'}
          <div class="adm-item-info">
            <strong>${esc(p.name)}</strong>
            <span class="adm-item-meta">TZS ${money(p.price)} · ${esc(cat ? cat.label : p.category)} · ${esc(seller ? seller.name : p.sellerId)}</span>
            <span class="adm-chip ${cls}">${esc(label)}</span>
          </div>
          <div class="adm-item-actions">
            <a class="adm-icon-btn" href="../product.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" aria-label="Ona ${esc(p.name)} kwenye tovuti"><i class="fa-solid fa-eye" aria-hidden="true"></i></a>
            <button type="button" class="adm-icon-btn" data-edit="${esc(p.id)}" aria-label="Hariri ${esc(p.name)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
            <button type="button" class="adm-icon-btn adm-danger-text" data-del="${esc(p.id)}" aria-label="Futa ${esc(p.name)}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
          </div>
        </li>`;
    }).join('') : '<li class="adm-empty">Hakuna bidhaa zinazolingana.</li>';
  }
  $('#productSearch').addEventListener('input', renderProducts);
  $('#statusFilter').addEventListener('change', renderProducts);
  $('#productList').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) openProductEditor(state.products.find(p => p.id === ed.dataset.edit));
    if (del) deleteProduct(del.dataset.del);
  });
  $('#addProductBtn').addEventListener('click', () => openProductEditor(null));

  /* ================================================================
     PRODUCT EDITOR
     ================================================================ */
  // draft.images: [{ path } (already in the repo) | { file blob, url, isNew: true }]
  let draft = null;

  function fillSelect(sel, items, value) {
    sel.innerHTML = items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    sel.value = value;
  }

  function openProductEditor(p) {
    const isNew = !p;
    draft = {
      originalId: p ? p.id : null,
      base: p ? JSON.parse(JSON.stringify(p)) : {},
      images: (p ? p.images : []).map(path => ({ path })),
      removed: [],
      idTouched: !isNew
    };
    $('#peTitle').textContent = isNew ? 'Bidhaa mpya' : `Hariri: ${p.name}`;
    $('#peName').value = p ? p.name : '';
    $('#peId').value = p ? p.id : '';
    $('#peId').readOnly = !isNew; // changing an id would break existing links and carts
    $('#peIdHint').textContent = isNew ? 'Inajazwa yenyewe kutoka kwenye jina. Herufi ndogo, namba na "-" tu.' : 'ID haibadilishwi ili viungo vya zamani viendelee kufanya kazi.';
    $('#pePrice').value = p ? p.price : '';
    $('#peOldPrice').value = p && p.oldPrice ? p.oldPrice : '';
    fillSelect($('#peCategory'), state.categories.map(c => [c.key, c.fullLabel || c.label]), p ? p.category : (state.categories[0] || {}).key);
    fillSelect($('#peSeller'), state.sellers.map(s => [s.id, `${s.name}${s.active === false ? ' (hayupo)' : ''}`]), p ? p.sellerId : (state.sellers[0] || {}).id);
    $('#peCondition').value = p ? (p.condition || '') : 'Mpya';
    $('#peStatus').value = p ? p.status : 'available';
    $('#peBadge').value = p ? (p.badge || '') : '';
    $('#peDescription').value = p ? p.description : '';
    $('#peSpecs').value = p ? (p.specs || []).map(s => (typeof s === 'string' ? s : `${s.label}: ${s.value}`)).join('\n') : '';
    $('#peOrderNote').value = p ? (p.orderNote || '') : '';
    $('#peMsg').hidden = true;
    renderDraftImages();
    openSheet($('#productEditor'));
  }

  $('#peName').addEventListener('input', () => { if (!draft.idTouched) $('#peId').value = slug($('#peName').value); });
  $('#peId').addEventListener('input', () => { draft.idTouched = true; });

  function renderDraftImages() {
    $('#peImages').innerHTML = draft.images.map((im, i) => `
      <li class="adm-img${i === 0 ? ' is-main' : ''}">
        ${im.isNew ? `<img src="${im.url}" alt="" width="96" height="96"/>` : imgTag(im.path)}
        ${i === 0 ? '<span class="adm-img-main">Kuu</span>' : ''}
        ${im.isNew ? `<span class="adm-img-new">Mpya · ${Math.round(im.blob.size / 1024)} KB</span>` : ''}
        <div class="adm-img-tools">
          <button type="button" data-img-move="-1" data-i="${i}" aria-label="Sogeza kushoto" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
          <button type="button" data-img-move="1" data-i="${i}" aria-label="Sogeza kulia" ${i === draft.images.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
          <button type="button" data-img-del data-i="${i}" aria-label="Ondoa picha"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </div>
      </li>`).join('') || '<li class="adm-empty">Hakuna picha bado.</li>';
  }

  $('#peImages').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const i = +b.dataset.i;
    if (b.hasAttribute('data-img-del')) {
      const [im] = draft.images.splice(i, 1);
      if (im.isNew) URL.revokeObjectURL(im.url); else draft.removed.push(im.path);
    } else {
      const j = i + Number(b.dataset.imgMove);
      [draft.images[i], draft.images[j]] = [draft.images[j], draft.images[i]];
    }
    renderDraftImages();
  });

  /* Resize a photo in the browser: longest side ≤ 1000px, JPEG ~82% */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Picha "${file.name}" haifunguki. Jaribu JPG au PNG.`)); };
      img.src = url;
    });
  }
  async function shrink(file) {
    const { img, url } = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs get a white background
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('Imeshindikana kuandaa picha.');
    return { blob, url: URL.createObjectURL(blob), isNew: true };
  }
  async function addFiles(files) {
    const list = [...files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    for (const f of list) {
      try { busy(`Inaandaa picha: ${f.name}`); draft.images.push(await shrink(f)); }
      catch (e) { fail(e); return; }
    }
    $('#admToast').hidden = true;
    renderDraftImages();
  }
  $('#peFiles').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('.adm-drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));

  function readProductForm() {
    const num = v => (v === '' ? undefined : Math.round(Number(v)));
    const cat = state.categories.find(c => c.key === $('#peCategory').value) || {};
    const base = draft.base;
    const name = $('#peName').value.trim();
    return Object.assign({}, base, {
      id: $('#peId').value.trim(),
      sellerId: $('#peSeller').value,
      name,
      category: $('#peCategory').value,
      price: num($('#pePrice').value),
      oldPrice: num($('#peOldPrice').value),
      description: $('#peDescription').value.trim().replace(/\s+/g, ' '),
      specs: $('#peSpecs').value.split('\n').map(s => s.trim()).filter(Boolean),
      alt: base.alt && base.name === name ? base.alt : name,
      condition: $('#peCondition').value,
      status: $('#peStatus').value,
      badge: $('#peBadge').value || undefined,
      // keep a custom icon only if the category did not change
      icon: base.icon && base.category === $('#peCategory').value ? base.icon : (cat.icon || 'fa-solid fa-box-open'),
      orderNote: $('#peOrderNote').value.trim() || undefined,
      addedOn: base.addedOn || today()
    });
  }

  function validateProduct(p, isNew) {
    if (!p.name) return 'Andika jina la bidhaa.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) return 'ID iwe na herufi ndogo, namba na "-" tu (mf. blue-backpack).';
    if (isNew && state.products.some(x => x.id === p.id)) return `ID "${p.id}" tayari ipo. Badilisha jina au ID.`;
    if (!(p.price > 0)) return 'Weka bei sahihi (namba kubwa kuliko 0).';
    if (p.oldPrice !== undefined && !(p.oldPrice > 0)) return 'Bei ya zamani iwe namba, au iache wazi.';
    if (!p.description) return 'Andika maelezo mafupi.';
    if (!draft.images.length) return 'Ongeza angalau picha moja.';
    if (p.specs.some(s => !s.includes(':'))) return 'Kila mstari wa specs uwe "Jina: thamani", mf. RAM: 8GB.';
    return '';
  }

  $('#productForm').addEventListener('submit', async e => {
    e.preventDefault();
    const isNew = !draft.originalId;
    const p = readProductForm();
    const err = validateProduct(p, isNew);
    const msg = $('#peMsg');
    if (err) { msg.textContent = err; msg.hidden = false; msg.scrollIntoView({ block: 'nearest' }); return; }
    msg.hidden = true;

    const saveBtn = $('#peSave');
    saveBtn.disabled = true;
    try {
      // 1. Upload new photos as blobs
      const stamp = Date.now().toString(36);
      const blobs = [];
      let n = 0;
      const newCount = draft.images.filter(im => im.isNew).length;
      for (const im of draft.images) {
        if (!im.isNew) continue;
        n++;
        busy(`Inapakia picha ${n}/${newCount}...`);
        im.path = `images/${p.sellerId}/${p.id}-${stamp}-${n}.jpg`;
        im.sha = await gh.uploadBlob(bytesToB64(new Uint8Array(await im.blob.arrayBuffer())));
        blobs.push({ path: im.path, sha: im.sha });
      }
      p.images = draft.images.map(im => im.path);
      const removed = draft.removed.slice();

      // 2. Commit photos + products.js (rebuilt from the newest version)
      busy('Inahifadhi...');
      const commit = await gh.commit(`Admin: ${isNew ? 'ongeza' : 'hariri'} bidhaa "${p.name}"`, blobs, async head => {
        const text = await gh.readText(FILES.products, head);
        const list = parseData(text, 'products');
        const idx = list.findIndex(x => x.id === (draft.originalId || p.id));
        if (isNew && idx >= 0) throw new Error(`ID "${p.id}" tayari ipo kwenye GitHub. Badilisha ID.`);
        if (!isNew && idx < 0) throw new Error('Bidhaa hii imefutwa kutoka kifaa kingine. Pakia upya.');
        if (isNew) list.push(cleanProduct(p)); else list[idx] = cleanProduct(p);
        // Delete removed photos only if no other product still uses them
        const used = new Set(list.flatMap(x => x.images || []));
        const deletes = removed.filter(path => !used.has(path) && path.startsWith('images/')).map(path => ({ path, delete: true }));
        return [{ path: FILES.products, text: writeArray(text, 'products', list) }, ...deletes];
      });
      closeSheet($('#productEditor'));
      await loadAll();
      done(commit);
    } catch (e2) {
      fail(e2);
    } finally {
      saveBtn.disabled = false;
    }
  });

  async function deleteProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const ans = await confirmBox(`Futa "${p.name}"?`,
      'Bidhaa itaondolewa kwenye tovuti. Kama unataka kuificha kwa muda tu, hariri bidhaa na uchague "Imeuzwa" au "Imefichwa".',
      'Futa pia picha zake (kama hazitumiki kwenye bidhaa nyingine)');
    if (!ans.ok) return;
    try {
      busy('Inafuta...');
      const commit = await gh.commit(`Admin: futa bidhaa "${p.name}"`, [], async head => {
        const text = await gh.readText(FILES.products, head);
        const list = parseData(text, 'products').filter(x => x.id !== id);
        const used = new Set(list.flatMap(x => x.images || []));
        const deletes = ans.opt ? (p.images || []).filter(path => !used.has(path) && path.startsWith('images/')).map(path => ({ path, delete: true })) : [];
        return [{ path: FILES.products, text: writeArray(text, 'products', list) }, ...deletes];
      });
      await loadAll();
      done(commit);
    } catch (e) { fail(e); }
  }

  /* ================================================================
     SELLERS
     ================================================================ */
  function renderSellers() {
    $('#countSellers').textContent = state.sellers.length;
    $('#sellerList').innerHTML = state.sellers.map(s => {
      const n = state.products.filter(p => p.sellerId === s.id).length;
      return `
        <li class="adm-item">
          <span class="adm-avatar" aria-hidden="true">${esc((s.name || '?').charAt(0))}</span>
          <div class="adm-item-info">
            <strong>${esc(s.name)}</strong>
            <span class="adm-item-meta">${esc(s.whatsapp)} · ${esc(s.area || '')} · bidhaa ${n}</span>
            <span class="adm-chip ${s.active === false ? 'hid' : 'ok'}">${s.active === false ? 'Hayupo' : 'Yupo'}</span>
          </div>
          <div class="adm-item-actions">
            <button type="button" class="adm-icon-btn" data-sedit="${esc(s.id)}" aria-label="Hariri ${esc(s.name)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
            <button type="button" class="adm-icon-btn adm-danger-text" data-sdel="${esc(s.id)}" aria-label="Futa ${esc(s.name)}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
          </div>
        </li>`;
    }).join('');
  }

  let sellerDraft = null;
  function openSellerEditor(s) {
    sellerDraft = { originalId: s ? s.id : null, base: s ? { ...s } : {}, idTouched: !!s };
    $('#seTitle').textContent = s ? `Hariri: ${s.name}` : 'Muuzaji mpya';
    $('#seName').value = s ? s.name : '';
    $('#seId').value = s ? s.id : '';
    $('#seId').readOnly = !!s;
    $('#seWhatsapp').value = s ? s.whatsapp : '';
    $('#seArea').value = s ? (s.area || '') : '';
    $('#seAbout').value = s ? (s.about || '') : 'Muuzaji mwanafunzi wa UDOM';
    $('#seActive').checked = s ? s.active !== false : true;
    $('#seMsg').hidden = true;
    openSheet($('#sellerEditor'));
  }
  $('#seName').addEventListener('input', () => { if (!sellerDraft.idTouched) $('#seId').value = slug($('#seName').value); });
  $('#seId').addEventListener('input', () => { sellerDraft.idTouched = true; });
  $('#addSellerBtn').addEventListener('click', () => openSellerEditor(null));
  $('#sellerList').addEventListener('click', e => {
    const ed = e.target.closest('[data-sedit]');
    const del = e.target.closest('[data-sdel]');
    if (ed) openSellerEditor(state.sellers.find(s => s.id === ed.dataset.sedit));
    if (del) deleteSeller(del.dataset.sdel);
  });

  $('#sellerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const isNew = !sellerDraft.originalId;
    const s = Object.assign({}, sellerDraft.base, {
      id: $('#seId').value.trim(),
      name: $('#seName').value.trim(),
      // Accept local format too: 0712 345 678 -> 255712345678
      whatsapp: $('#seWhatsapp').value.replace(/\D/g, '').replace(/^0(?=[67]\d{8}$)/, '255'),
      area: $('#seArea').value.trim(),
      about: $('#seAbout').value.trim(),
      active: $('#seActive').checked
    });
    let err = '';
    if (!s.name) err = 'Andika jina la muuzaji.';
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) err = 'ID iwe na herufi ndogo, namba na "-" tu.';
    else if (isNew && state.sellers.some(x => x.id === s.id)) err = `ID "${s.id}" tayari ipo.`;
    else if (!/^255[67]\d{8}$/.test(s.whatsapp)) err = 'Namba ya WhatsApp iwe 255 ikifuatiwa na tarakimu 9, mf. 2557XXXXXXXX.';
    if (err) { $('#seMsg').textContent = err; $('#seMsg').hidden = false; return; }

    $('#seSave').disabled = true;
    try {
      busy('Inahifadhi...');
      const commit = await gh.commit(`Admin: ${isNew ? 'ongeza' : 'hariri'} muuzaji "${s.name}"`, [], async head => {
        const text = await gh.readText(FILES.sellers, head);
        const list = parseData(text, 'sellers');
        const idx = list.findIndex(x => x.id === (sellerDraft.originalId || s.id));
        if (isNew && idx >= 0) throw new Error(`ID "${s.id}" tayari ipo kwenye GitHub.`);
        if (isNew) list.push(cleanSeller(s)); else list[idx] = cleanSeller(s);
        return [{ path: FILES.sellers, text: writeArray(text, 'sellers', list) }];
      });
      closeSheet($('#sellerEditor'));
      await loadAll();
      done(commit);
    } catch (e2) { fail(e2); } finally { $('#seSave').disabled = false; }
  });

  async function deleteSeller(id) {
    const s = state.sellers.find(x => x.id === id);
    const n = state.products.filter(p => p.sellerId === id).length;
    if (n) { toast(`<i class="fa-solid fa-circle-info" aria-hidden="true"></i> ${esc(s.name)} ana bidhaa ${n}. Futa au hamisha bidhaa hizo kwanza, au mweke "Hayupo".`, 'bad'); return; }
    if (state.sellers.length === 1) { toast('Lazima kuwe na muuzaji angalau mmoja.', 'bad'); return; }
    const ans = await confirmBox(`Futa muuzaji "${s.name}"?`, 'Muuzaji ataondolewa kwenye orodha.');
    if (!ans.ok) return;
    try {
      busy('Inafuta...');
      const commit = await gh.commit(`Admin: futa muuzaji "${s.name}"`, [], async head => {
        const text = await gh.readText(FILES.sellers, head);
        return [{ path: FILES.sellers, text: writeArray(text, 'sellers', parseData(text, 'sellers').filter(x => x.id !== id)) }];
      });
      await loadAll();
      done(commit);
    } catch (e) { fail(e); }
  }

  /* ================================================================
     TABS
     ================================================================ */
  const tabs = [$('#tabProducts'), $('#tabSellers')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = tabs[(i + 1) % 2]; selectTab(n); n.focus(); }
    });
  });
  function selectTab(tab) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }

  /* ================================================================
     LOGIN / LOGOUT
     ================================================================ */
  function readCfg() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(storage.get(KEY_CFG) || '{}')); } catch (e) { return { ...DEFAULTS }; }
  }

  async function connect(token, cfg) {
    const [owner, repo] = String(cfg.repo).split('/');
    if (!owner || !repo) throw new Error('Andika repository kama "mmiliki/jina", mf. Mussa-kitto/winga-msomi.');
    Object.assign(gh, { token, owner, repo, branch: cfg.branch });
    const info = await gh.req('GET', gh.r(''));
    if (!info.permissions || !info.permissions.push) {
      const err = new Error('Token hii haina ruhusa ya kuandika kwenye repository hii.'); err.status = 403; throw err;
    }
    state.isPrivate = !!info.private;
    try { await gh.headSha(); } catch (e) { if (e.status === 404) throw new Error(`Branch "${cfg.branch}" haipo.`); throw e; }
    try { await loadAll(); } catch (e) {
      if (e.status === 404) throw new Error(`Faili za data (js/data/products.js) hazipo kwenye branch "${cfg.branch}". Hakikisha Pull Request ya marketplace imeunganishwa (merge).`);
      throw e;
    }
    $('#repoInfo').textContent = `${owner}/${repo} · ${cfg.branch}`;
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const token = $('#loginToken').value.trim();
    const cfg = { repo: $('#loginRepo').value.trim(), branch: $('#loginBranch').value.trim() };
    const remember = $('#loginRemember').checked;
    const msg = $('#loginMsg');
    const btn = e.submitter || $('#loginForm button[type=submit]');
    msg.hidden = true;
    btn.disabled = true;
    try {
      await connect(token, cfg);
      storage.set(KEY_TOKEN, token, remember);
      storage.set(KEY_CFG, JSON.stringify(cfg), true);
      $('#loginToken').value = '';
    } catch (err) {
      msg.textContent = err.status === 401 ? 'Token si sahihi au imeisha muda.' : err.message;
      msg.hidden = false;
    } finally { btn.disabled = false; }
  });

  $('#logoutBtn').addEventListener('click', () => {
    storage.del(KEY_TOKEN);
    gh.token = '';
    state.products = []; state.sellers = [];
    $('#appView').hidden = true;
    showLogin();
  });
  $('#reloadBtn').addEventListener('click', async () => {
    try { busy('Inapakia...'); await loadAll(); toast('<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Data mpya imepakiwa.', 'ok'); } catch (e) { fail(e); }
  });

  function showLogin() {
    const cfg = readCfg();
    $('#loginRepo').value = cfg.repo;
    $('#loginBranch').value = cfg.branch;
    $('#loginView').hidden = false;
    $('#loginToken').focus();
  }

  // Start: reuse a saved token if there is one
  (async () => {
    const token = storage.get(KEY_TOKEN);
    if (!token) { showLogin(); return; }
    try { busy('Inaunganisha...'); await connect(token, readCfg()); $('#admToast').hidden = true; }
    catch (e) { $('#admToast').hidden = true; showLogin(); $('#loginMsg').textContent = e.status === 401 ? 'Token imeisha muda. Weka token mpya.' : e.message; $('#loginMsg').hidden = false; }
  })();

  // Exposed for the dev test page only
  window.WMAdminInternals = { parseData, writeArray, fmt, cleanProduct, slug };
})();
