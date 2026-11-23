/* Winga Msomi — Vercel Web Analytics setup. Load BEFORE /_vercel/insights/script.js.
   Product pages are product.html?id=<id>; the analytics dashboard ignores "?id=",
   so every product would count as one page. Report them as /product/<id> instead. */
(function () {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  window.va('beforeSend', function (event) {
    try {
      var u = new URL(event.url);
      var id = u.searchParams.get('id');
      if (/\/product(\.html)?$/.test(u.pathname) && id) {
        u.pathname = '/product/' + encodeURIComponent(id);
        u.search = '';
        event.url = u.href;
      }
    } catch (e) { /* send unchanged */ }
    return event;
  });
})();

/* Count WhatsApp clicks. Custom events need a paid plan, so each click is sent as a
   virtual page view: /whatsapp/oda/<id>, /whatsapp/uliza/<id>, /whatsapp/uza, /whatsapp/<other>.
   In the dashboard, open Pages and filter "/whatsapp" to see orders per product. */
(function () {
  function kindFor(a, text) {
    if (a.closest('[data-wa="sell"], #sellForm')) return 'uza';
    if (/Naomba maelezo zaidi/.test(text)) return 'uliza';
    if (/^(Nataka |Habari! Nataka kuagiza)/.test(text)) return 'oda';
    return a.dataset.wa || 'mawasiliano';
  }
  function track(href, a) {
    try {
      var u = new URL(href, location.href);
      if (!/(^|\.)wa\.me$|whatsapp\.com$/.test(u.hostname)) return;
      var text = u.searchParams.get('text') || '';
      var kind = kindFor(a, text);
      var m = text.match(/product\.html\?id=([^\s&]+)/);
      var path = '/whatsapp/' + kind + (m ? '/' + decodeURIComponent(m[1]) : '');
      if (window.va) window.va('pageview', { route: path, path: path });
    } catch (e) { /* never block the click */ }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) track(a.href, a);
  }, true);
  window.WM = window.WM || {};
  window.WM.trackWa = track;
})();
