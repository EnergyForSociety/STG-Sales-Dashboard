/* STAR Dashboard — ตัวแสดงผลหน้าดีไซน์ (.dc.html) จาก Claude Design บนเว็บ static
   - หน้าทั้งหมด (รวมตัวเลข) อยู่ใน bundle ที่เข้ารหัส: gate.js ถอดรหัสแล้วเรียก DASHApp.start(bundle)
   - รองรับรูปแบบ DC เท่าที่ไฟล์ดีไซน์ใช้: {{ path }} (ค้นค่าตาม path เท่านั้น), <sc-for list as>, <sc-if value>,
     onClick="{{ fn }}", class Component extends DCLogic { renderVals() } + setState / lifecycle
   - ลิงก์ X.dc.html → เปลี่ยนหน้าในเว็บนี้ (#/X) · ปุ่มส่งออก CSV ใช้ window.claude.use('downloads') ที่จำลองไว้ด้านล่าง */
'use strict';
(function () {
  var root = document.getElementById('dc-root');
  var BUNDLE = null, current = null, helmetNodes = [];

  /* ---------- ค่าใน hole ---------- */
  var HOLE = /\{\{\s*([^}]*?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]*?)\s*\}\}$/;
  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(scope, p); return v == null ? '' : String(v); });
  }
  function hasHole(s) { return s.indexOf('{{') >= 0; }

  /* ---------- แปลง template เป็นโครงที่อัปเดตได้ ---------- */
  function compile(nodes) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 3) {
        out.push(hasHole(n.data) ? { t: 'text', s: n.data } : { t: 'static', n: n });
      } else if (n.nodeType === 1) {
        var tag = n.localName;
        var sc = tag === 'template' ? n.getAttribute('data-sc') : null;
        var kidsOf = sc ? n.content.childNodes : n.childNodes;
        if (sc === 'for') {
          out.push({ t: 'for', list: (n.getAttribute('list') || '').replace(WHOLE, '$1'), as: n.getAttribute('as') || 'item', kids: compile(kidsOf) });
        } else if (sc === 'if') {
          out.push({ t: 'if', value: (n.getAttribute('value') || '').replace(WHOLE, '$1'), kids: compile(kidsOf) });
        } else if (tag === 'script') {
          continue;
        } else {
          var dyn = [], evs = [];
          for (var a = 0; a < n.attributes.length; a++) {
            var at = n.attributes[a];
            if (!hasHole(at.value)) continue;
            var m = at.value.match(WHOLE);
            if (/^on[a-z]+$/i.test(at.name) && m) evs.push({ ev: at.name.slice(2).toLowerCase(), path: m[1] });
            else dyn.push({ name: at.name === 'classname' ? 'class' : at.name, s: at.value });
          }
          var shell = n.cloneNode(false);
          dyn.concat(evs.map(function (e) { return { name: 'on' + e.ev }; })).forEach(function (d) {
            // ลบ attribute ที่มี hole ออกจากต้นแบบ (รวม on*) — กันไม่ให้ browser ตีความเป็นโค้ด
            for (var k = shell.attributes.length - 1; k >= 0; k--) if (shell.attributes[k].name.toLowerCase() === d.name.toLowerCase()) shell.removeAttribute(shell.attributes[k].name);
          });
          out.push({ t: 'el', shell: shell, dyn: dyn, evs: evs, kids: compile(n.childNodes) });
        }
      } else if (n.nodeType === 8) { /* comment: ข้าม */ }
    }
    return out;
  }

  /* view: { nodes():[], update(scope), remove() } */
  function mount(spec, parent, before, scope) {
    var views = spec.map(function (s) { return mountOne(s, parent, before, scope); });
    return {
      update: function (sc) { views.forEach(function (v) { v.update(sc); }); },
      remove: function () { views.forEach(function (v) { v.remove(); }); },
      first: function () { for (var i = 0; i < views.length; i++) { var f = views[i].first(); if (f) return f; } return null; }
    };
  }
  function mountOne(s, parent, before, scope) {
    if (s.t === 'static') {
      var st = document.importNode(s.n, true); parent.insertBefore(st, before);
      return { update: function () {}, remove: function () { st.remove(); }, first: function () { return st; } };
    }
    if (s.t === 'text') {
      var tn = document.createTextNode(interp(s.s, scope)); parent.insertBefore(tn, before);
      return { update: function (sc) { var v = interp(s.s, sc); if (tn.data !== v) tn.data = v; }, remove: function () { tn.remove(); }, first: function () { return tn; } };
    }
    if (s.t === 'el') {
      var el = document.importNode(s.shell, false), cur = scope, last = {};
      s.evs.forEach(function (e) {
        el.addEventListener(e.ev, function (evt) {
          if (el.localName === 'a' && el.getAttribute('href') === '#') evt.preventDefault();
          var f = lookup(cur, e.path); if (typeof f === 'function') f(evt);
        });
      });
      var setAttrs = function (sc) {
        s.dyn.forEach(function (d) {
          var m = d.s.match(WHOLE), v = m ? lookup(sc, m[1]) : interp(d.s, sc);
          if (v === false || v == null) { if (last[d.name] !== null) { el.removeAttribute(d.name); last[d.name] = null; } return; }
          v = String(v);
          if (last[d.name] !== v) { el.setAttribute(d.name, v); last[d.name] = v; }
        });
      };
      setAttrs(scope);
      parent.insertBefore(el, before);
      var kids = mount(s.kids, el, null, scope);
      return { update: function (sc) { cur = sc; setAttrs(sc); kids.update(sc); }, remove: function () { el.remove(); }, first: function () { return el; } };
    }
    if (s.t === 'for') {
      var anchor = document.createComment('for'); parent.insertBefore(anchor, before);
      var items = [];
      var sync = function (sc) {
        var list = lookup(sc, s.list); if (!Array.isArray(list)) list = [];
        for (var i = 0; i < list.length; i++) {
          var isc = Object.create(sc); isc[s.as] = list[i]; isc.$index = i;
          if (items[i]) items[i].update(isc);
          else items.push(mount(s.kids, anchor.parentNode, anchor, isc));
        }
        while (items.length > list.length) items.pop().remove();
      };
      sync(scope);
      return { update: sync, remove: function () { items.forEach(function (v) { v.remove(); }); anchor.remove(); }, first: function () { return items.length ? items[0].first() : null; } };
    }
    if (s.t === 'if') {
      var anc = document.createComment('if'); parent.insertBefore(anc, before);
      var inner = null;
      var syncIf = function (sc) {
        var v = lookup(sc, s.value);
        if (v) { if (inner) inner.update(sc); else inner = mount(s.kids, anc.parentNode, anc, sc); }
        else if (inner) { inner.remove(); inner = null; }
      };
      syncIf(scope);
      return { update: syncIf, remove: function () { if (inner) inner.remove(); anc.remove(); }, first: function () { return inner ? inner.first() : null; } };
    }
  }

  /* ---------- DCLogic ---------- */
  function DCLogic(props) { this.props = props || {}; this.state = undefined; }
  DCLogic.prototype.setState = function (patch, cb) {
    var p = typeof patch === 'function' ? patch(this.state || {}, this.props) : patch;
    this.state = Object.assign({}, this.state || {}, p || {});
    if (this.__dc_schedule) this.__dc_schedule();
    if (cb) setTimeout(cb, 0);
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__dc_schedule) this.__dc_schedule(); };
  DCLogic.prototype.renderVals = function () { return {}; };

  /* ---------- ส่งออกไฟล์ (แทน window.claude.use('downloads') ของ Claude Design) ---------- */
  window.claude = {
    use: function (name) {
      if (name !== 'downloads') return Promise.resolve(null);
      return Promise.resolve({
        save: function (o) {
          var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: /\.csv$/i.test(o.filename) ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
          var url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url; a.download = o.filename || 'export.csv'; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
          return Promise.resolve();
        }
      });
    }
  };

  /* ---------- โหลดหน้า ---------- */
  function pageNames() { return (BUNDLE && BUNDLE.order) || Object.keys(BUNDLE.pages); }
  function fileFromHash() {
    var h = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    if (h && !/\.dc\.html$/.test(h)) h += '.dc.html';
    return BUNDLE.pages[h] ? h : pageNames()[0];
  }
  function unmountCurrent() {
    if (!current) return;
    try { if (current.comp.componentWillUnmount) current.comp.componentWillUnmount(); } catch (e) { console.error(e); }
    current.comp.__dc_schedule = null;
    if (current.raf) cancelAnimationFrame(current.raf);
    current.view.remove();
    helmetNodes.forEach(function (n) { n.remove(); }); helmetNodes = [];
    current = null;
  }
  function show(file) {
    unmountCurrent();
    var src = BUNDLE.pages[file];
    // <sc-for>/<sc-if> ใน <tbody> จะถูก HTML parser ย้ายออกจากตาราง จึงแปลงเป็น <template data-sc> ก่อน parse
    src = src.replace(/<sc-(for|if)\b/g, '<template data-sc="$1"').replace(/<\/sc-(for|if)>/g, '</template>');
    var doc = new DOMParser().parseFromString(src, 'text/html');
    var xdc = doc.querySelector('x-dc');
    var title = doc.querySelector('title');
    document.title = (title ? title.textContent : 'STAR') + ' · STAR Dashboard';
    var helmet = xdc.querySelector('helmet');
    if (helmet) {
      Array.prototype.slice.call(helmet.children).forEach(function (n) {
        if (n.localName === 'link' && /fonts\.(googleapis|gstatic)\.com/.test(n.getAttribute('href') || '')) return;
        var c = document.importNode(n, true); document.head.appendChild(c); helmetNodes.push(c);
      });
      helmet.remove();
    }
    var spec = compile(xdc.childNodes);
    var scriptEl = doc.querySelector('script[data-dc-script]');
    var Component = scriptEl ? new Function('DCLogic', scriptEl.textContent + '\n;return Component;')(DCLogic) : DCLogic;
    var props = {};
    try { var dp = JSON.parse(scriptEl.getAttribute('data-props') || '{}'); Object.keys(dp).forEach(function (k) { if (k[0] !== '$' && dp[k] && 'default' in dp[k]) props[k] = dp[k].default; }); } catch (e) {}
    var comp = new Component(props);
    var cur = { comp: comp, raf: 0 };
    var vals = function () { var v = comp.renderVals() || {}; return v; };
    cur.view = mount(spec, root, null, vals());
    comp.__dc_schedule = function () {
      if (cur.raf) return;
      cur.raf = requestAnimationFrame(function () { cur.raf = 0; try { cur.view.update(vals()); wireChrome(); } catch (e) { console.error(e); } });
    };
    current = cur;
    wireChrome();
    window.scrollTo(0, 0);
    try { if (comp.componentDidMount) comp.componentDidMount(); } catch (e) { console.error(e); }
  }

  /* ส่วนหัวของดีไซน์มีชื่อผู้ใช้และปุ่มออกจากระบบ — ผูกกับ gate (data-dc-who / data-dc-logout ใส่ตอน build) */
  function wireChrome() {
    var who = document.getElementById('who');
    var name = who ? who.textContent : '';
    root.querySelectorAll('[data-dc-who]').forEach(function (n) { if (n.textContent !== name) n.textContent = name; });
    root.querySelectorAll('[data-dc-logout]').forEach(function (b) {
      if (b.__wired) return; b.__wired = 1;
      b.addEventListener('click', function () { var lo = document.getElementById('logout'); if (lo) lo.click(); });
    });
  }

  /* ลิงก์ระหว่างหน้า */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !BUNDLE) return;
    var href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; }
    var m = href.match(/^(?:\.\/|\/)?([\w-]+\.dc\.html)$/);
    if (m && BUNDLE.pages[m[1]]) { e.preventDefault(); location.hash = '#/' + m[1].replace(/\.dc\.html$/, ''); }
  });
  window.addEventListener('hashchange', function () {
    if (!BUNDLE) return;
    var f = fileFromHash();
    if (current && current.file === f) return;
    show(f); current.file = f;
  });

  function start(bundle) {
    BUNDLE = bundle.ds.pages;
    var f = fileFromHash(); show(f); current.file = f;
  }
  function fail(msg) { root.innerHTML = ''; var d = document.createElement('div'); d.className = 'dc-err'; d.textContent = msg; root.appendChild(d); }

  if (window.DASH_STATIC) window.DASHApp = { start: function (b) { try { start(b); } catch (e) { console.error(e); fail('แสดงหน้า Dashboard ไม่สำเร็จ: ' + e.message); } } };
  else fetch('../data/pages.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (p) { start({ ds: { pages: p } }); })
    .catch(function (e) { fail('โหลดข้อมูลไม่สำเร็จ (' + e.message + ') — รัน node scripts/build_pages.js ก่อน'); });
})();
