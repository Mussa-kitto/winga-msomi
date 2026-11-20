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
