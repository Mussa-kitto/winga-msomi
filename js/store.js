/* ================================================================
   WINGA MSOMI — store.js
   Cart state shared by all pages. Saved in localStorage when
   available; falls back to memory if storage is blocked.
   Every change fires a "wm:cart" event on window.
   Needs: data/*.js, render.js (WM.catalog)
   ================================================================ */
window.WM = window.WM || {};

WM.cart = (function () {
  const KEY = 'wm-cart-v1';
  const MAX_QTY = 99;
  let items = []; // [{ id, qty }]

  const clampQty = q => Math.max(1, Math.min(MAX_QTY, parseInt(q, 10) || 1));

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return items; } // storage blocked or corrupt: keep memory copy
  }

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* memory only */ }
  }

  // Keep only products that still exist and can be ordered; merge duplicates
  function clean(list) {
    const out = [];
    list.forEach(it => {
      const p = it && WM.catalog.product(it.id);
      if (!p || !WM.catalog.isVisible(p) || p.status !== 'available') return;
      const found = out.find(o => o.id === it.id);
      if (found) found.qty = clampQty(found.qty + clampQty(it.qty));
      else out.push({ id: it.id, qty: clampQty(it.qty) });
    });
    return out;
  }

  function emit() {
    window.dispatchEvent(new CustomEvent('wm:cart', { detail: { count: count() } }));
  }

  function save() { write(); emit(); }

  function load() {
    const raw = read();
    items = clean(raw);
    if (items.length !== raw.length) write(); // silently drop removed products
  }

  /* ── public API ── */
  function add(id, qty) {
    const p = WM.catalog.product(id);
    if (!p || !WM.catalog.isVisible(p) || p.status !== 'available') return false;
    const found = items.find(i => i.id === id);
    if (found) found.qty = clampQty(found.qty + clampQty(qty || 1));
    else items.push({ id, qty: clampQty(qty || 1) });
    save();
    return true;
  }

  function setQty(id, qty) {
    const found = items.find(i => i.id === id);
    if (!found) return;
    found.qty = clampQty(qty);
    save();
  }

  function remove(id) {
    items = items.filter(i => i.id !== id);
    save();
  }

  function clear() { items = []; save(); }

  function count() { return items.reduce((n, i) => n + i.qty, 0); }

  // Items joined with their product data: [{ product, qty, subtotal }]
  function lines() {
    return items.map(i => {
      const product = WM.catalog.product(i.id);
      return { product, qty: i.qty, subtotal: product.price * i.qty };
    });
  }

  function total() { return lines().reduce((t, l) => t + l.subtotal, 0); }

  load();

  // Another tab changed the cart: reload and notify
  window.addEventListener('storage', e => {
    if (e.key === KEY) { load(); emit(); }
  });

  return { add, setQty, remove, clear, count, lines, total, MAX_QTY };
})();
