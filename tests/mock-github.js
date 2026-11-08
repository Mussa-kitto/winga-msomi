/* ================================================================
   DEV ONLY — fake GitHub API for testing admin/index.html locally.
   Loaded only on localhost with ?mock=1 (tests/ is not deployed).
   Starts from the local js/data files; nothing is sent anywhere.
   Inspect window.__mockGH in the console (commits, files).
   Token "bad" -> 401, "readonly" -> no push permission.
   ================================================================ */
(function () {
  const realFetch = window.fetch.bind(window);
  const DATA = ['js/data/products.js', 'js/data/sellers.js', 'js/data/categories.js'];
  let n = 0;
  const id = p => `${p}${(++n).toString(16).padStart(8, '0')}`;
  const toB64 = t => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
  const fromB64 = b => new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)));

  const S = window.__mockGH = {
    ready: null,
    blobs: {},            // sha -> { text } | { b64 }
    trees: {},            // sha -> Map(path -> blobSha)
    commits: {},          // sha -> { tree, parents, message }
    head: null,
    log: [],              // commit messages in order
    calls: [],            // [method, path]
    filesAt(sha) {        // { path: text } for text files at a commit
      const out = {};
      const tree = this.trees[this.commits[sha].tree];
      tree.forEach((b, p) => { out[p] = this.blobs[b].text ?? `<binary ${this.blobs[b].b64.length} b64 chars>`; });
      return out;
    }
  };

  S.ready = (async () => {
    const map = new Map();
    for (const p of DATA) {
      const sha = id('blob');
      S.blobs[sha] = { text: await realFetch(`/${p}`, { cache: 'no-store' }).then(r => r.text()) };
      map.set(p, sha);
    }
    // Pretend every image referenced by a product exists in the repo
    const t = S.blobs[map.get(DATA[0])].text; // read without eval (admin page runs under a strict CSP)
    const products = JSON.parse(`[${t.slice(t.indexOf('WM.products = [') + 15, t.lastIndexOf('];')).replace(/,\s*$/, '')}]`);
    products.forEach(p => p.images.forEach(img => {
      if (!map.has(img)) { const sha = id('blob'); S.blobs[sha] = { b64: 'AAAA' }; map.set(img, sha); }
    }));
    const tree = id('tree'); S.trees[tree] = map;
    const c = id('commit'); S.commits[c] = { tree, parents: [], message: 'initial' };
    S.head = c;
  })();

  const json = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  window.fetch = async (url, init = {}) => {
    if (!String(url).startsWith('https://api.github.com')) return realFetch(url, init);
    await S.ready;
    const u = new URL(url);
    const method = (init.method || 'GET').toUpperCase();
    const auth = (init.headers && init.headers.Authorization) || '';
    const body = init.body ? JSON.parse(init.body) : null;
    S.calls.push([method, u.pathname]);
    if (/Bearer bad$/.test(auth)) return json(401, { message: 'Bad credentials' });

    const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
    if (!m) return json(404, { message: 'Not Found' });
    const rest = m[3] || '';

    if (method === 'GET' && rest === '') {
      return json(200, { full_name: `${m[1]}/${m[2]}`, private: false, permissions: { push: !/Bearer readonly$/.test(auth) } });
    }
    let r;
    if (method === 'GET' && (r = rest.match(/^\/git\/ref\/heads\/(.+)$/))) {
      return decodeURIComponent(r[1]) === 'main' ? json(200, { object: { sha: S.head } }) : json(404, { message: 'Not Found' });
    }
    if (method === 'GET' && (r = rest.match(/^\/git\/commits\/(\w+)$/))) {
      const c = S.commits[r[1]];
      return c ? json(200, { sha: r[1], tree: { sha: c.tree } }) : json(404, { message: 'Not Found' });
    }
    if (method === 'GET' && (r = rest.match(/^\/git\/trees\/(\w+)$/))) {
      const t = S.trees[r[1]];
      return json(200, { sha: r[1], tree: [...t.keys()].map(path => ({ path, type: 'blob', sha: t.get(path) })) });
    }
    if (method === 'GET' && (r = rest.match(/^\/contents\/(.+)$/))) {
      const path = decodeURIComponent(r[1]);
      const ref = u.searchParams.get('ref');
      const c = S.commits[ref];
      const blob = c && S.trees[c.tree].get(path);
      if (!blob) return json(404, { message: 'Not Found' });
      return json(200, { path, sha: blob, content: S.blobs[blob].text !== undefined ? toB64(S.blobs[blob].text) : S.blobs[blob].b64 });
    }
    if (method === 'POST' && rest === '/git/blobs') {
      const sha = id('blob');
      S.blobs[sha] = body.encoding === 'base64' ? { b64: body.content } : { text: body.content };
      return json(201, { sha });
    }
    if (method === 'POST' && rest === '/git/trees') {
      const map = new Map(S.trees[body.base_tree]);
      for (const e of body.tree) {
        if (e.sha === null) {
          if (!map.has(e.path)) return json(422, { message: `path ${e.path} not in tree` });
          map.delete(e.path);
        } else if (e.content !== undefined) {
          const sha = id('blob'); S.blobs[sha] = { text: e.content }; map.set(e.path, sha);
        } else {
          if (!S.blobs[e.sha]) return json(422, { message: 'unknown blob' });
          map.set(e.path, e.sha);
        }
      }
      const sha = id('tree'); S.trees[sha] = map;
      return json(201, { sha });
    }
    if (method === 'POST' && rest === '/git/commits') {
      const sha = id('commit');
      S.commits[sha] = { tree: body.tree, parents: body.parents, message: body.message };
      return json(201, { sha, html_url: `https://github.com/mock/commit/${sha}` });
    }
    if (method === 'PATCH' && (r = rest.match(/^\/git\/refs\/heads\/(.+)$/))) {
      const c = S.commits[body.sha];
      if (!c || c.parents[0] !== S.head) return json(422, { message: 'Update is not a fast forward' });
      S.head = body.sha;
      S.log.push(c.message);
      return json(200, { object: { sha: body.sha } });
    }
    return json(404, { message: `mock: no route ${method} ${rest}` });
  };
  // Helper for a test: simulate a commit made from another device
  S.externalEdit = (path, fn) => {
    const c = S.commits[S.head];
    const map = new Map(S.trees[c.tree]);
    const sha = id('blob'); S.blobs[sha] = { text: fn(S.blobs[map.get(path)].text) }; map.set(path, sha);
    const tree = id('tree'); S.trees[tree] = map;
    const nc = id('commit'); S.commits[nc] = { tree, parents: [S.head], message: 'external edit' };
    S.head = nc; S.log.push('external edit');
  };
})();
