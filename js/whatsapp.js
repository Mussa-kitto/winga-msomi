/* ================================================================
   WINGA MSOMI — whatsapp.js
   The ONLY place that builds wa.me links and order message text.
   Needs: data/site.js, data/sellers.js
   ================================================================ */
window.WM = window.WM || {};

WM.wa = (function () {
  const site = WM.site || {};
  const msg = site.messages || {};

  const digits = s => String(s || '').replace(/\D/g, '');
  const money = n => Number(n || 0).toLocaleString('en-US');
  // Fill {key} placeholders in a template
  const fill = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

  /* Which number receives messages for a seller.
     forceWhatsappNumber (site.js) overrides every seller while it is set. */
  function numberFor(sellerId) {
    if (site.forceWhatsappNumber) return digits(site.forceWhatsappNumber);
    const seller = (WM.sellers || []).find(s => s.id === sellerId);
    return digits(seller && seller.whatsapp) || digits(site.contactWhatsapp);
  }

  function link(number, text) {
    const base = `https://wa.me/${digits(number)}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
  }

  // General contact link (header, floating button, footer)
  function contactLink(text) {
    return link(site.contactWhatsapp, text === undefined ? msg.general : text);
  }

  // Message for ordering a single product
  function productOrderText(p) {
    const line = fill(msg.orderOne, { name: p.name, price: money(p.price) });
    return p.orderNote ? `${line} ${p.orderNote}` : line;
  }

  function productOrderLink(p) {
    return link(numberFor(p.sellerId), productOrderText(p));
  }

  // "I couldn't find what I want" request, optionally with the search query
  function requestLink(query) {
    const q = query ? ` Bidhaa ninayotafuta ni: ${query}.` : '';
    return contactLink(fill(msg.requestProduct, { query: q }));
  }

  return { numberFor, link, contactLink, productOrderText, productOrderLink, requestLink, money };
})();
