/* Winga Msomi — "Uza Nasi" seller form.
   No backend: the form fills a WhatsApp message to the contact number. */
(function () {
  var form = document.getElementById('sellForm');
  if (!form || !window.WM || !WM.wa) return;
  var err = document.getElementById('sellErr');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, v = function (n) { return String(f[n].value || '').trim(); };
    var bei = v('bei').replace(/[^0-9]/g, '');
    if (!v('jina') || !v('mahali') || !v('bidhaa') || !bei) { err.hidden = false; return; }
    err.hidden = true;
    var lines = [
      'Habari Winga Msomi! Nataka kuuza bidhaa kupitia Winga Msomi.',
      'Jina langu: ' + v('jina'),
      'Chuo/Hostel: ' + v('mahali'),
      'Bidhaa: ' + v('bidhaa'),
      'Bei (TZS): ' + Number(bei).toLocaleString('en-US'),
      'Hali: ' + v('hali')
    ];
    if (v('maelezo')) lines.push('Maelezo: ' + v('maelezo'));
    lines.push('Nitatuma picha za bidhaa hapa.');
    var href = WM.wa.contactLink(lines.join('\n'));
    if (WM.trackWa) WM.trackWa(href, form);
    window.open(href, '_blank', 'noopener');
  });
})();
