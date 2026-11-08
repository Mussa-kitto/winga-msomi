/* ================================================================
   WINGA MSOMI — whatsapp.js
   The ONLY place that builds wa.me links and order message text.
   Needs: data/site.js, data/sellers.js
   ================================================================ */
window.WM = window.WM || {};

WM.wa = (function () {
  const site = WM.site || {};
  const msg = site.messages || {};
  const MAX = site.maxLinkLength || 2000;

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

  // Absolute link to a product page (works on any host the site is served from)
  function productUrl(p) {
    try { return new URL(`product.html?id=${encodeURIComponent(p.id)}`, location.href).href; }
    catch (e) { return `product.html?id=${encodeURIComponent(p.id)}`; }
  }

  // General contact link (header, floating button, footer)
  function contactLink(text) {
    return link(site.contactWhatsapp, text === undefined ? msg.general : text);
  }

  /* Message for ordering one product (quantity optional, default 1) */
  function productOrderText(p, qty) {
    qty = qty || 1;
    const vars = { name: p.name, qty, price: money(p.price), total: money(p.price * qty) };
    let line = fill(qty > 1 ? msg.orderQty : msg.orderOne, vars);
    if (p.orderNote) line += ` ${p.orderNote}`;
    return `${line}\n${productUrl(p)}`;
  }

  function productOrderLink(p, qty) {
    return link(numberFor(p.sellerId), productOrderText(p, qty));
  }

  // "Chat na Muuzaji": ask the seller about one product
  function productChatLink(p) {
    const text = `${fill(msg.askProduct, { name: p.name, price: money(p.price) })}\n${productUrl(p)}`;
    return link(numberFor(p.sellerId), text);
  }

  // "I couldn't find what I want" request, optionally with the search query
  function requestLink(query) {
    const q = query ? ` Bidhaa ninayotafuta ni: ${query}.` : '';
    return contactLink(fill(msg.requestProduct, { query: q }));
  }

  /* Cart order message for a list of lines [{ product, qty, subtotal }].
     withLinks=false leaves out product page links (used to shorten long orders). */
  function cartText(lines, withLinks = true) {
    const total = lines.reduce((t, l) => t + l.subtotal, 0);
    const items = lines.map((l, i) => {
      const p = l.product;
      let row = fill(msg.cartItem, { n: i + 1, name: p.name, qty: l.qty, price: money(p.price), total: money(l.subtotal) });
      if (p.orderNote) row += ` ${p.orderNote}`;
      return withLinks ? `${row}\n${productUrl(p)}` : row;
    });
    return [msg.cartGreeting, '', items.join('\n\n'), '', fill(msg.cartTotal, { total: money(total) }), '', msg.buyerDetails].join('\n');
  }

  /* Split cart lines into one WhatsApp order per receiving number.
     While forceWhatsappNumber is set, everything is one combined order.
     Returns [{ number, sellers: [names], lines, total, url, tooLong }] */
  function cartOrders(lines) {
    const groups = [];
    lines.forEach(l => {
      const number = numberFor(l.product.sellerId);
      let g = groups.find(x => x.number === number);
      if (!g) groups.push(g = { number, sellerIds: [], lines: [] });
      if (!g.sellerIds.includes(l.product.sellerId)) g.sellerIds.push(l.product.sellerId);
      g.lines.push(l);
    });
    return groups.map(g => {
      let url = link(g.number, cartText(g.lines));
      if (url.length > MAX) url = link(g.number, cartText(g.lines, false)); // drop links first
      return {
        number: g.number,
        sellers: g.sellerIds.map(id => ((WM.sellers || []).find(s => s.id === id) || { name: id }).name),
        lines: g.lines,
        total: g.lines.reduce((t, l) => t + l.subtotal, 0),
        url,
        tooLong: url.length > MAX
      };
    });
  }

  return { numberFor, link, productUrl, contactLink, productOrderText, productOrderLink, productChatLink, requestLink, cartText, cartOrders, money };
})();
