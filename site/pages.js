/* STAR Dashboard — ตัวคำนวณของแต่ละหน้า (แทนตัวเลขตายตัวในไฟล์ดีไซน์)
   แต่ละหน้า = ฟังก์ชันที่รับ Component ของดีไซน์ แล้วคืนคลาสลูกที่ renderVals() คำนวณจากข้อมูลตามตัวกรอง
   ไฟล์นี้ไม่มีตัวเลขธุรกิจ — ข้อมูลอยู่ใน bundle ที่เข้ารหัส */
'use strict';
window.STAR_PAGES = (function () {
  var S = window.STAR;
  var UP = 'var(--up)', DOWN = 'var(--down)';
  var NUM = "font-family: 'Outfit', 'IBM Plex Sans Thai', sans-serif; ";
  var CHIP = { STG: ['#E7F5E1', '#2F6B1C'], STP: ['#FDF1D3', '#7A5300'], TWP: ['#E6E8F1', '#3E4A7C'] };
  var chip = function (c) { var m = CHIP[c] || ['var(--tint)', 'var(--brand)']; return "flex: none; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; padding: 2px 9px; border-radius: 999px; background: " + m[0] + '; color: ' + m[1]; };
  var G_COLOR = { 'น้ำมัน': '#421A26', 'LPG': '#C49A76', 'NGV': '#3E4A7C', 'Non-Oil': '#8C7B80', 'อื่น ๆ / รอจัดประเภท': '#D9CABD' };
  var CH_COLOR = { 'ค้าปลีก': 'var(--hero)', 'ค้าส่ง': '#C49A76' };
  var dcol = function (d) { return d >= 0 ? UP : DOWN; };

  /* ข้อความสถานะข้อมูล (หัวหน้า) */
  function stamp(extra) {
    var m = S.M.meta, f = m.generated_at || '';
    var dt = f ? new Date(f) : null;
    var fetched = dt ? dt.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '–';
    var thd = dt ? S.thDate(S.dayOf(f.slice(0, 10))) + ' ' + fetched.slice(-5) : '';
    return { stamp: 'ข้อมูลจริงจาก TRCloud · ดึง ' + thd + (extra || ''), fetched: fetched, lastDoc: S.thDate(S.MAXDAY) };
  }
  /* ตัวกรองมาตรฐานหน้ายอดขาย */
  function salesFilters(rows2) {
    var F = S.F;
    return { rows: [[F.period(), F.from(), F.to(), F.cos(), F.channel()], rows2 || [F.station(), F.group(), F.product()]], reset: F.resetSales, note: F.note };
  }

  /* ================= 1 · Executive Snapshot ================= */
  var Main = function (Base) {
    return class extends Base {
      __filters() { return salesFilters(); }
      renderVals() {
        var th = this.__theme(), self = this, p = th.p, c = S.ctx(), b = this.__calc(c);
        var a = c.tc, pv = c.tp;
        var retail = S.sum(c.cur.filter(function (l) { return l[14] === 0; })), retailP = c.cp ? S.sum(c.cmp.filter(function (l) { return l[14] === 0; })) : null;
        var nonoil = S.sum(c.cur.filter(function (l) { return S.grp(l) === 'Non-Oil'; })), nonoilP = c.cp ? S.sum(c.cmp.filter(function (l) { return S.grp(l) === 'Non-Oil'; })) : null;
        var nShare = a ? nonoil / a * 100 : 0, nShareP = pv ? nonoilP / pv * 100 : null;
        var subs = Array.from(S.groupBy(c.cur.filter(function (l) { return S.grp(l) === 'Non-Oil'; }), function (l) { return S.P[l[3]].sub; })).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 2);
        var cnt = { a: (a / 1e6 * p).toFixed(2), b: pv == null ? '–' : (a - pv >= 0 ? '+' : '−') + (Math.abs(a - pv) / 1e6 * p).toFixed(2), c: (retail / 1e6 * p).toFixed(2), d: (nShare * p).toFixed(1) + '%' };
        var k = {
          aD: pv ? (a >= pv ? '▲ ' : '▼ ') + S.pct(a, pv) : 'ไม่มีช่วงเทียบ', aP: pv ? 'จาก ' + S.mb(pv) : '', aStyle: "font-family: 'Outfit', sans-serif; font-weight: 500; color: " + (a >= (pv || 0) ? '#9FE0A8' : '#F5A3A3'),
          bNote: pv == null ? 'ไม่มีช่วงเปรียบเทียบ (ข้อมูลเริ่ม ม.ค. 2569)' : 'เทียบ ' + c.cmpLabel + ' · YoY: ยังไม่มี (ข้อมูลเริ่ม ม.ค. 2569)',
          cLbl: 'ค้าปลีก', cD: retailP ? (retail >= retailP ? '▲ ' : '▼ ') + S.pct(retail, retailP) : '', cP: '· ' + S.fmt(a ? retail / a * 100 : 0, 1) + '% ของยอด', cStyle: NUM + 'font-weight: 500; color: ' + dcol(retail - (retailP || 0)),
          dD: nShareP == null ? '' : (nShare >= nShareP ? '▲ ' : '▼ ') + S.fmt(Math.abs(nShare - nShareP), 1) + ' จุด', dP: subs.length ? '· ' + subs.map(function (x) { return x[0] + ' ' + S.mb(x[1]); }).join(' · ') : '· ไม่มียอด Non-Oil ในตัวกรอง', dStyle: NUM + 'font-weight: 500; color: ' + dcol(nShare - (nShareP || 0))
        };
        var exp = {
          companies: function () { S.csv('STAR_เปรียบเทียบบริษัท.csv', ['บริษัท', 'ชื่อ', c.label + ' (บาท)', c.cmpLabel + ' (บาท)', 'ผลต่าง (บาท)', 'สัดส่วน'], b.companies.map(function (x) { return [x.code, x.th, x.rc.toFixed(2), x.rp == null ? '' : x.rp.toFixed(2), x.rp == null ? '' : (x.rc - x.rp).toFixed(2), x.share]; })); },
          movers: function () { S.csv('STAR_หน่วยที่ยอดเปลี่ยนมากสุด.csv', ['บริษัท', 'หน่วย', c.label + ' (บาท)', c.cmpLabel + ' (บาท)', 'ผลต่าง (บาท)'], b.moversAll.map(function (m) { return [m.co, m.name, m.c.toFixed(2), m.p.toFixed(2), (m.c - m.p).toFixed(2)]; })); },
          groups: function () { S.csv('STAR_ยอดตามกลุ่มธุรกิจ.csv', ['กลุ่มธุรกิจ', c.label + ' (บาท)', c.cmpLabel + ' (บาท)', 'ผลต่าง (บาท)'], b.groups.map(function (g) { return [g.name, g.c.toFixed(2), g.p == null ? '' : g.p.toFixed(2), g.p == null ? '' : (g.c - g.p).toFixed(2)]; })); },
          insights: function () { S.csv('STAR_ประเด็นผู้บริหาร.csv', ['ข้อ', 'ประเด็น', 'ตัวเลข', 'สิ่งที่พบ', 'ขอบเขต', 'ผลกระทบ', 'ควรตรวจสอบ', 'ผู้รับผิดชอบ'], b.insights.map(function (i) { return [i.n, i.title, i.fig, i.found, i.scope, i.impact, i.action, i.owner]; })); }
        };
        return Object.assign(b, th, { cnt: cnt, k: k, exp: exp, pt: Object.assign(stamp(), { label: c.label }) });
      }
      __calc(c) {
        var self = this, st = this.state || {}, view = st.view || 'co', p = this.__theme().p;
        /* กราฟรายเดือน */
        var keyf, keys, colors;
        if (view === 'biz') { keyf = S.grp; keys = S.GROUPS; colors = keys.map(function (g) { return G_COLOR[g]; }); }
        else if (view === 'ch') { keyf = function (l) { return S.CH[l[14]]; }; keys = S.CH; colors = keys.map(function (k) { return CH_COLOR[k]; }); }
        else { keyf = S.co; keys = S.CO.filter(function (x) { return S.S.cos.indexOf(x) >= 0; }); colors = keys.map(function (k) { return S.CO_COLOR[k]; }); }
        var mon = S.monthly(keyf, keys), n = mon.length;
        var maxT = Math.max.apply(null, mon.map(function (m) { return m.total; }).concat([1]));
        var step = [1, 2, 2.5, 5, 10].map(function (x) { var e = Math.pow(10, Math.floor(Math.log10(maxT / 4))); return x * e; }).find(function (s) { return s * 4 >= maxT; }) || maxT / 4;
        var top = step * 4, unit = top >= 4e6 ? 1e6 : 1e3;
        var axis = [4, 3, 2, 1, 0].map(function (i) { return { v: S.fmt(step * i / unit, step / unit < 1 ? 1 : 0), st: 'position: absolute; right: 0; bottom: ' + (i / 4 * 260 - 6) + 'px; line-height: 1' }; });
        var A0 = S.dayDate(c.a).getUTCMonth(), B0 = S.dayDate(c.b).getUTCMonth(), lastM = S.dayDate(S.MAXDAY), partialLast = lastM.getUTCDate() !== new Date(Date.UTC(lastM.getUTCFullYear(), lastM.getUTCMonth() + 1, 0)).getUTCDate();
        var months = mon.map(function (m, i) {
          var t = m.total, sel = i >= A0 && i <= B0;
          var segs = keys.map(function (k, j) { return { k: k, v: m.vals[j], color: colors[j] }; }).filter(function (x) { return x.v > 0; }).reverse()
            .map(function (x) { return { st: 'height: ' + (t > 0 ? (x.v / t * 100).toFixed(2) : 0) + '%; background: ' + x.color }; });
          return { lbl: m.label + ' ' + String(lastM.getUTCFullYear() + 543).slice(2), h: (t / top * 100 * p).toFixed(2) + '%', segs: segs, op: i === n - 1 && partialLast ? '0.45' : '1',
            tip: m.label + ' · รวม ' + S.mb(t) + ' · ' + keys.map(function (k, j) { return k + ' ' + S.mb(m.vals[j]); }).join(' · '),
            colStyle: 'flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 8px; ' + (sel ? 'background: var(--tint)' : ''),
            lblStyle: 'flex: 1; min-width: 0; text-align: center; font-size: 12px; white-space: nowrap; ' + (sel ? 'color: var(--brand); font-weight: 600' : 'color: var(--muted)') };
        });
        var full = mon.slice(0, partialLast ? n - 1 : n), ma = [];
        for (var i = 2; i < full.length; i++) ma.push({ i: i, v: (full[i].total + full[i - 1].total + full[i - 2].total) / 3 });
        var maPts = ma.map(function (d) { return ((d.i + 0.5) / n * 1100).toFixed(1) + ',' + (260 - d.v / top * 260 * p).toFixed(1); }).join(' ');
        var maDots = ma.map(function (d) { return { tip: mon[d.i].label + ' เฉลี่ย 3 เดือน ' + S.mb(d.v), style: 'position: absolute; width: 9px; height: 9px; margin: 0 0 -4.5px -4.5px; border-radius: 999px; background: var(--card); border: 2px solid var(--brand); left: ' + ((d.i + 0.5) / n * 100).toFixed(2) + '%; bottom: ' + (d.v / top * 100 * p).toFixed(2) + '%' }; });
        var legend = keys.map(function (k, j) { return { name: k, sw: 'width: 12px; height: 12px; border-radius: 2px; background: ' + colors[j] }; });
        var vbtn = function (id, label) { var on = view === id; return { label: label, pressed: String(on), pick: function () { self.setState({ view: id }); },
          style: 'min-height: 38px; padding: 0 14px; border: 0; border-radius: 3px; font: inherit; font-size: 14px; cursor: pointer; ' + (on ? 'background: var(--hero); font-weight: 600; color: #FFFFFF' : 'background: transparent; color: var(--muted)') }; };
        var views = [vbtn('co', 'บริษัท'), vbtn('biz', 'ธุรกิจ'), vbtn('ch', 'ช่องทาง')];
        var chartNote = (partialLast ? mon[n - 1].label + ' ' + String(lastM.getUTCFullYear() + 543).slice(2) + ' ถึง ' + S.thDate(S.MAXDAY) + ' (ยังไม่จบเดือน ไม่ควรเทียบกับเดือนเต็ม) · ' : '') + 'หน่วยแกน: ' + (unit === 1e6 ? 'ล้านบาท' : 'พันบาท');

        /* บริษัท */
        var byC = S.groupBy(c.cur, S.co), byCp = S.groupBy(c.cmp, S.co);
        var companies = S.CO.filter(function (x) { return S.S.cos.indexOf(x) >= 0; }).map(function (code) {
          var rc = byC.get(code) || 0, rp = c.cp ? (byCp.get(code) || 0) : null, sh = c.tc ? rc / c.tc * 100 : 0;
          return { code: code, th: S.CO_TH[code], rc: rc, rp: rp, cur: S.M2(rc), prev: rp == null ? '–' : S.M2(rp), diff: S.diffTxt(rc, rp), share: S.fmt(sh, 1) + '%', color: S.CO_COLOR[code], chip: chip(code),
            diffStyle: NUM + 'font-size: 14px; font-weight: 500; color: ' + dcol(rc - (rp || 0)), bar: 'height: 100%; border-radius: 999px; width: ' + sh.toFixed(1) + '%; background: ' + S.CO_COLOR[code] };
        });
        var tot = { n: companies.length, v: S.mb(c.tc), d: S.diffTxt(c.tc, c.tp), dStyle: 'font-weight: 500; font-size: 14px; color: ' + dcol(c.tc - (c.tp || 0)) };

        /* หน่วยที่ยอดเปลี่ยนมากสุด */
        var byU = S.groupBy(c.cur, function (l) { return l[2]; }), byUp = S.groupBy(c.cmp, function (l) { return l[2]; });
        var moversAll = Array.from(new Set(Array.from(byU.keys()).concat(Array.from(byUp.keys())))).map(function (ui) {
          var u = S.U[ui]; return { co: u.company, name: S.unitLabel(u) + (u.business_group ? ' · ' + u.business_group : ''), c: byU.get(ui) || 0, p: byUp.get(ui) || 0, gap: S.unitGaps(ui, c.a, c.b).length > 0 };
        }).filter(function (m) { return Math.abs(m.c - m.p) > 1; });
        var ups = moversAll.filter(function (m) { return m.c > m.p; }).sort(function (x, y) { return (y.c - y.p) - (x.c - x.p); }).slice(0, 4);
        var downs = moversAll.filter(function (m) { return m.c < m.p; }).sort(function (x, y) { return (x.c - x.p) - (y.c - y.p); }).slice(0, 4);
        var mvMax = Math.max.apply(null, ups.concat(downs).map(function (m) { return Math.abs(m.c - m.p); }).concat([1]));
        var movers = c.cp ? ups.concat(downs).map(function (m) {
          var d = m.c - m.p, w = (Math.abs(d) / mvMax * 100).toFixed(1) + '%', up = d >= 0;
          return { co: m.co, name: (m.gap ? '△ ' : '') + m.name, val: S.diffTxt(m.c, m.p), chip: chip(m.co),
            pos: up ? 'height: 100%; width: ' + w + '; background: ' + UP + '; border-radius: 0 999px 999px 0' : 'display: none',
            neg: up ? 'display: none' : 'height: 100%; width: ' + w + '; background: ' + DOWN + '; border-radius: 999px 0 0 999px',
            valStyle: NUM + 'font-size: 14px; font-weight: 500; text-align: right; white-space: nowrap; color: ' + (up ? UP : DOWN) };
        }) : [];

        /* ค้าปลีก/ค้าส่ง + กลุ่มธุรกิจ */
        var ch = function (i, rows) { return S.sum(rows.filter(function (l) { return l[14] === i; })); };
        var r1 = ch(0, c.cur), w1 = ch(1, c.cur), r0 = c.cp ? ch(0, c.cmp) : null, w0 = c.cp ? ch(1, c.cmp) : null, T = r1 + w1 || 1;
        var chn = { rShare: S.fmt(r1 / T * 100, 1) + '%', wShare: S.fmt(w1 / T * 100, 1) + '%', rV: S.mb(r1), wV: S.mb(w1), rD: S.diffTxt(r1, r0), wD: S.diffTxt(w1, w0),
          rDStyle: NUM + 'font-size: 13px; font-weight: 500; color: ' + dcol(r1 - (r0 || 0)), wDStyle: NUM + 'font-size: 13px; font-weight: 500; color: ' + dcol(w1 - (w0 || 0)),
          rBar: 'width: ' + (r1 / T * 100).toFixed(1) + '%; background: var(--hero)', wBar: 'width: ' + (w1 / T * 100).toFixed(1) + '%; background: #C49A76' };
        var g1 = S.groupBy(c.cur, S.grp), g0 = S.groupBy(c.cmp, S.grp);
        var groups = S.GROUPS.map(function (g) { var x = g1.get(g) || 0, y = c.cp ? (g0.get(g) || 0) : null; return { name: g, c: x, p: y }; }).filter(function (g) { return g.c || g.p; })
          .map(function (g) { g.val = S.mb(g.c); g.diff = S.diffTxt(g.c, g.p); g.diffStyle = NUM + 'font-size: 13px; font-weight: 500; text-align: right; white-space: nowrap; color: ' + dcol(g.c - (g.p || 0)); return g; });

        /* ประเด็นผู้บริหาร */
        var fig = function (col) { return NUM + 'font-size: 14px; font-weight: 600; color: ' + col; };
        var insights = S.insights(c).map(function (x) { x.figStyle = fig(x.up == null ? 'var(--brand)' : x.up ? UP : DOWN); return x; });
        var insNote = insights.length + ' ข้อ · ' + c.scope;

        return { months: months, maPts: maPts, maDots: maDots, axis: axis, legend: legend, views: views, chartNote: chartNote,
          companies: companies, tot: tot, movers: movers, moversAll: moversAll, groups: groups, chn: chn, insights: insights, insNote: insNote };
      }
    };
  };

  /* ตารางแกน y 5 ค่า (0..สูงสุด) */
  function niceAxis(maxV, n) {
    n = n || 4; maxV = Math.max(maxV, 1);
    var e = Math.pow(10, Math.floor(Math.log10(maxV / n)));
    var step = [1, 2, 2.5, 5, 10].map(function (x) { return x * e; }).find(function (s) { return s * n >= maxV; }) || maxV / n;
    var unit = step * n >= 4e6 ? 1e6 : 1e3;
    return { top: step * n, unit: unit, unitTxt: unit === 1e6 ? 'ล้านบาท' : 'พันบาท', vals: Array.from({ length: n + 1 }, function (_, i) { return { v: S.fmt(step * (n - i) / unit, step / unit < 1 ? 1 : 0) }; }) };
  }
  var cell = function (v, muted) { return { v: v, st: 'padding: 12px 10px; border-bottom: 1px solid var(--line)' + (muted ? '; color: var(--muted)' : '') }; };

  /* ================= 4 · ธุรกิจและสินค้า ================= */
  var Products = function (Base) {
    return class extends Base {
      __filters() { var F = S.F; return { rows: [[F.period(), F.from(), F.to(), F.cos(), F.channel()], [F.station(), F.group(), F.product()]], reset: F.resetSales, note: F.note }; }
      renderVals() {
        var th = this.__theme(), c = S.ctx(), b = this.__calc(c);
        var exp = {
          matrix: function () { S.csv('STAR_ช่องทางxกลุ่มธุรกิจ.csv', ['ช่องทาง'].concat(S.GROUPS, ['รวม', 'ช่วงเทียบ']), b.matrix.map(function (r) { return [r.ch].concat(r.raw.map(function (v) { return v.toFixed(2); }), [r.rc.toFixed(2), r.rp == null ? '' : r.rp.toFixed(2)]); })); },
          units: function () { S.csv('STAR_กลุ่มธุรกิจและหน่วยย่อย.csv', ['ระดับ', 'กลุ่ม/หน่วยย่อย', c.label + ' (บาท)', c.cmpLabel + ' (บาท)', 'สัดส่วน'], b.units.map(function (u) { return [u.lvl, u.name, u.c.toFixed(2), u.p == null ? '' : u.p.toFixed(2), u.share]; })); },
          vols: function () { S.csv('STAR_ปริมาณและราคาเฉลี่ย.csv', ['บริษัท', 'สินค้า', 'กลุ่ม', 'หน่วย', 'ปริมาณ', 'ปริมาณช่วงเทียบ', 'ราคาเฉลี่ย', 'ราคาเฉลี่ยช่วงเทียบ'], b.vols.map(function (v) { return [v.co, v.name, v.grp, v.unit, v.q.toFixed(2), v.qp == null ? '' : v.qp.toFixed(2), v.pr == null ? '' : v.pr.toFixed(4), v.prp == null ? '' : v.prp.toFixed(4)]; })); },
          gps: function () { S.csv('STAR_กำไรขั้นต้นIV3.csv', ['กลุ่ม', 'หน่วยย่อย', 'ยอดขาย (บาท)', 'ความครอบคลุมต้นทุน', 'GP (บาท)', 'GP%'], b.gps.map(function (g) { return [g.grp, g.name, g.s.toFixed(2), g.cov, g.show ? g.g.toFixed(2) : '', g.gpp]; })); }
        };
        return Object.assign(b, th, { exp: exp, pt: stamp(), scope: c.scope });
      }
      __calc(c) {
        var P = S.P, sub = function (l) { return P[l[3]].sub || P[l[3]].group; };
        /* ช่องทาง × กลุ่ม */
        var matrix = S.CH.map(function (ch, ci) {
          var rows = c.cur.filter(function (l) { return l[14] === ci; }), rowsP = c.cmp.filter(function (l) { return l[14] === ci; });
          var g = S.groupBy(rows, S.grp), raw = S.GROUPS.map(function (x) { return g.get(x) || 0; });
          var rc = S.sum(rows), rp = c.cp ? S.sum(rowsP) : null;
          return { ch: ch, raw: raw, rc: rc, rp: rp, cells: raw.map(function (v) { return cell(v ? S.mb(v) : '–', !v); }), tot: S.mb(rc), d: S.diffTxt(rc, rp),
            dSt: 'padding: 12px 10px; border-bottom: 1px solid var(--line); font-weight: 500; color: ' + dcol(rc - (rp || 0)) };
        }).filter(function (r) { return r.rc || r.rp; });
        /* กลุ่ม → หน่วยย่อย */
        var tot = c.tc || 1, units = [];
        S.GROUPS.forEach(function (g) {
          var rows = c.cur.filter(function (l) { return S.grp(l) === g; }), rowsP = c.cmp.filter(function (l) { return S.grp(l) === g; });
          var gc = S.sum(rows), gp = c.cp ? S.sum(rowsP) : null; if (!gc && !gp) return;
          var push = function (lvl, name, x, y) { units.push({ lvl: lvl, name: name, c: x, p: y, cur: S.mb(x), prev: y == null ? '–' : S.mb(y), diff: S.diffTxt(x, y), share: S.fmt(x / tot * 100, 1) + '%',
            trStyle: lvl === 'กลุ่ม' ? 'background: var(--bg)' : '', nameStyle: 'padding: 9px 8px; border-bottom: 1px solid var(--line); ' + (lvl === 'กลุ่ม' ? 'font-weight: 600; color: var(--brand)' : 'padding-left: 24px'),
            diffStyle: NUM + 'font-weight: 500; color: ' + dcol(x - (y || 0)) }); };
          push('กลุ่ม', g, gc, gp);
          var s1 = S.groupBy(rows, sub), s0 = S.groupBy(rowsP, sub);
          Array.from(new Set(Array.from(s1.keys()).concat(Array.from(s0.keys())))).map(function (k) { return [k, s1.get(k) || 0, c.cp ? (s0.get(k) || 0) : null]; })
            .sort(function (a, b) { return b[1] - a[1]; }).forEach(function (r) { push('หน่วยย่อย', r[0], r[1], r[2]); });
        });
        /* ส่วนผสมรายเดือน: น้ำมัน / LPG / อื่น ๆ */
        var mon = S.monthly(function (l) { var g = S.grp(l); return g === 'น้ำมัน' || g === 'LPG' ? g : 'อื่น'; }, ['น้ำมัน', 'LPG', 'อื่น']);
        var ax = niceAxis(Math.max.apply(null, mon.map(function (m) { return m.total; }))), last = S.dayDate(S.MAXDAY);
        var partial = last.getUTCDate() !== new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0)).getUTCDate();
        var A0 = S.dayDate(c.a).getUTCMonth(), B0 = S.dayDate(c.b).getUTCMonth();
        var mix = mon.map(function (m, i) {
          var t = m.total || 1, sel = i >= A0 && i <= B0;
          return { lbl: m.label, h: (m.total / ax.top * 100).toFixed(1) + '%', s1: (m.vals[0] / t * 100).toFixed(1) + '%', s2: (m.vals[1] / t * 100).toFixed(1) + '%', s3: (m.vals[2] / t * 100).toFixed(1) + '%',
            op: i === mon.length - 1 && partial ? '0.45' : '1', tip: m.label + ' · น้ำมัน ' + S.mb(m.vals[0]) + ' · LPG ' + S.mb(m.vals[1]) + ' · อื่น ๆ ' + S.mb(m.vals[2]),
            colStyle: 'flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 3px; ' + (sel ? 'background: var(--tint)' : ''),
            lblStyle: 'flex: 1; min-width: 0; text-align: center; font-size: 12px; white-space: nowrap; ' + (sel ? 'color: var(--brand); font-weight: 600' : 'color: var(--muted)') };
        });
        /* ปริมาณและราคาเฉลี่ย (น้ำมัน + LPG) */
        var vq = function (rows) { var m = new Map(); rows.forEach(function (l) { var g = S.grp(l); if ((g !== 'น้ำมัน' && g !== 'LPG') || !(l[6] === 1 || l[6] === 2)) return; var a = m.get(l[3]) || [0, 0]; a[0] += l[5]; a[1] += l[7]; m.set(l[3], a); }); return m; };
        var q1 = vq(c.cur), q0 = vq(c.cmp);
        var vols = Array.from(new Set(Array.from(q1.keys()).concat(Array.from(q0.keys())))).map(function (pi) {
          var p = P[pi], a = q1.get(pi) || [0, 0], b = c.cp ? q0.get(pi) || [0, 0] : null;
          var pr = a[0] ? a[1] / a[0] : null, prp = b && b[0] ? b[1] / b[0] : null;
          return { pi: pi, co: p.co, chip: chip(p.co), name: p.name, grp: p.sub || p.group, unit: p.vol_unit || 'หน่วย', q: a[0], qp: b ? b[0] : null, pr: pr, prp: prp, amt: a[1],
            qty: S.fmt(a[0]), qtyPrev: b ? S.fmt(b[0]) : '–', price: pr == null ? '–' : S.fmt(pr, 2), pricePrev: prp == null ? '–' : S.fmt(prp, 2),
            d: pr != null && prp != null ? (pr >= prp ? '▲ +' : '▼ −') + S.fmt(Math.abs(pr - prp), 2) : '–', dStyle: NUM + 'font-weight: 500; color: ' + (pr != null && prp != null ? dcol(pr - prp) : 'var(--muted)') };
        }).filter(function (v) { return v.q > 0 || (v.qp || 0) > 0; }).sort(function (x, y) { return y.amt - x.amt; });
        /* GP ตาม IV3 */
        var gm = new Map();
        c.cur.forEach(function (l) { var k = S.grp(l) + '|' + sub(l), a = gm.get(k) || { s: 0, cs: 0, cost: 0 }; a.s += l[7]; if (l[8] > 0) { a.cs += l[7]; a.cost += l[8]; } gm.set(k, a); });
        var gps = Array.from(gm).filter(function (x) { return Math.abs(x[1].s) > 1; }).sort(function (a, b) { return b[1].s - a[1].s; }).map(function (x) {
          var k = x[0].split('|'), a = x[1], cov = a.s > 0 ? a.cs / a.s : 0, show = cov >= 0.9, g = a.cs - a.cost;
          return { grp: k[0], name: k[1], s: a.s, g: g, show: show, sales: S.mb(a.s), cov: S.fmt(cov * 100, 0) + '%',
            covBar: 'height: 100%; border-radius: 999px; width: ' + Math.min(100, cov * 100).toFixed(0) + '%; background: ' + (show ? 'var(--up)' : '#C49A76'),
            gp: show ? S.mb(g) : 'ไม่แสดง', gpp: show && a.cs ? S.fmt(g / a.cs * 100, 1) + '%' : '–', gpStyle: NUM + 'font-weight: 500; color: ' + (show ? dcol(g) : 'var(--muted)') };
        });
        return { matrix: matrix, units: units, mix: mix, mixAxis: ax.vals, mixNote: ax.unitTxt + ' · ' + (last.getUTCFullYear() + 543) + ' · ตามตัวกรองบริษัท/ช่องทาง/สถานี/กลุ่ม (ไม่ขึ้นกับช่วงเวลา)', vols: vols, gps: gps };
      }
    };
  };

  /* ================= 5 · บริษัทและสถานี ================= */
  var Stations = function (Base) {
    return class extends Base {
      __filters() { var F = S.F; return { rows: [[F.period(), F.from(), F.to(), F.cos()], [F.channel(), F.group()]], reset: F.resetSales, note: F.note }; }
      renderVals() {
        var th = this.__theme(), c = S.ctx({ station: true, product: true }), b = this.__calc(c);
        var exp = { rows: function () { S.csv('STAR_สถานีและหน่วยธุรกิจ.csv', ['กลุ่ม', 'บริษัท', 'สถานี/หน่วย', 'สินค้าหลัก', c.label + ' (บาท)', c.cmpLabel + ' (บาท)', 'สัดส่วน', 'วันที่มีรายการ', 'เอกสารล่าสุด'],
          b.rows.filter(function (r) { return r.isRow; }).map(function (r) { return [r.group, r.co, r.name, r.unit, r.c.toFixed(2), r.p == null ? '' : r.p.toFixed(2), r.share, r.days, r.last]; })); } };
        return Object.assign(b, th, { exp: exp, pt: stamp() });
      }
      __calc(c) {
        var self = this, st = this.state || {};
        var byU = S.groupBy(c.cur, function (l) { return l[2]; }), byUp = S.groupBy(c.cmp, function (l) { return l[2]; });
        var subOf = new Map(); c.cur.concat(c.cmp).forEach(function (l) { var m = subOf.get(l[2]) || new Map(), k = S.P[l[3]].sub || S.P[l[3]].group; m.set(k, (m.get(k) || 0) + Math.abs(l[7])); subOf.set(l[2], m); });
        var days = Math.min(c.b, S.MAXDAY) - c.a + 1, maxShare = 0;
        var units = Array.from(new Set(Array.from(byU.keys()).concat(Array.from(byUp.keys())))).map(function (ui) {
          var u = S.U[ui], cv = byU.get(ui) || 0, pv = c.cp ? (byUp.get(ui) || 0) : null, sh = c.tc ? cv / c.tc * 100 : 0; maxShare = Math.max(maxShare, sh);
          var subs = Array.from(subOf.get(ui) || []).sort(function (a, b) { return b[1] - a[1]; });
          return { ui: ui, u: u, g: u.business_group || 'อื่น ๆ / สำนักงาน', c: cv, p: pv, sh: sh, main: subs.length ? subs[0][0] : '', have: S.unitDaysIn(ui, c.a, Math.min(c.b, S.MAXDAY)) };
        }).filter(function (r) { return Math.abs(r.c) > 0.5 || Math.abs(r.p || 0) > 0.5; });
        var order = ['น้ำมัน', 'LPG', 'NGV', 'Non-Oil'];
        var groups = Array.from(new Set(units.map(function (r) { return r.g; }))).sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 9 : x) - (y < 0 ? 9 : y); });
        var selUi = st.sel != null && units.some(function (r) { return r.ui === st.sel; }) ? st.sel : (units.slice().sort(function (a, b) { return b.c - a.c; })[0] || {}).ui;
        var rows = [], selected = null;
        groups.forEach(function (g) {
          rows.push({ isGroup: true, isRow: false, name: g });
          units.filter(function (r) { return r.g === g; }).sort(function (a, b) { return b.c - a.c; }).forEach(function (r) {
            var on = r.ui === selUi, full = r.have >= days || /NGV|สำนักงาน|ค่าเช่า|7-Eleven/.test(r.u.station_name + r.main);
            var row = { isGroup: false, isRow: true, ui: r.ui, co: r.u.company, name: S.unitLabel(r.u), unit: r.main, c: r.c, p: r.p, cur: S.mb(r.c), prev: r.p == null ? '–' : S.mb(r.p), diff: S.diffTxt(r.c, r.p),
              share: S.fmt(r.sh, 1) + '%', days: r.have + '/' + days, last: S.unitLast[r.ui] >= 0 ? S.iso(S.unitLast[r.ui]) : '–', group: g, mapping: g === 'NGV', chip: chip(r.u.company), pressed: String(on),
              pick: function () { self.setState({ sel: r.ui }); }, trStyle: on ? 'background: var(--tint)' : '',
              diffStyle: NUM + 'font-weight: 500; color: ' + dcol(r.c - (r.p || 0)),
              bar: 'height: 100%; border-radius: 999px; width: ' + (maxShare ? r.sh / maxShare * 100 : 0).toFixed(0) + '%; background: ' + (S.CO_COLOR[r.u.company] || 'var(--sand)'),
              daysStyle: "font-family: 'Outfit', sans-serif; " + (full ? 'color: var(--muted)' : 'color: var(--sandtx); font-weight: 600') };
            if (on) selected = row; rows.push(row);
          });
        });
        var sel = selected || { co: '', name: 'ไม่มีข้อมูลในตัวกรอง', unit: '', group: '', cur: '–', prev: '–', diff: '', share: '', days: '', last: '', mapping: false, chip: '' };
        sel.curLbl = c.label; sel.prevLbl = c.cmpLabel;
        /* กราฟรายวัน */
        var n = Math.max(1, Math.min(c.b, S.MAXDAY) - c.a + 1), d1 = new Array(n).fill(0), d0 = new Array(n).fill(0), has = new Array(n).fill(false);
        if (selected) {
          c.cur.forEach(function (l) { if (l[2] === selUi) { d1[l[0] - c.a] += l[7]; has[l[0] - c.a] = true; } });
          if (c.cp) c.cmp.forEach(function (l) { if (l[2] === selUi && l[0] - c.cp[0] < n) d0[l[0] - c.cp[0]] += l[7]; });
        }
        var mx = Math.max.apply(null, d1.concat(d0).concat([1])), X = function (i) { return n === 1 ? 150 : (i / (n - 1) * 296 + 2).toFixed(1); }, Y = function (v) { return (116 - Math.max(0, v) / mx * 108).toFixed(1); };
        sel.pts = d1.map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ');
        sel.ptsPrev = c.cp ? d0.map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ') : '';
        var gaps = selected ? S.unitGaps(selUi, c.a, c.b) : [];
        sel.miss = gaps.map(function (d) { var x = +X(d - c.a); return 'M' + (x - 2.5) + ',114 a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0'; }).join(' ');
        sel.grid = 'M0,116 H300 M0,62 H300 M0,8 H300';
        sel.d0 = S.thDate(c.a); sel.d1 = S.thDate(Math.min(c.b, S.MAXDAY));
        sel.legend = 'สูงสุด ' + S.mb(mx) + '/วัน · ทึบ = ช่วงที่เลือก · ประ = ช่วงเทียบ' + (gaps.length ? ' · จุดส้ม = ไม่พบรายการ ' + gaps.length + ' วัน' : '');
        sel.chartLbl = 'ยอดขายรายวัน ' + sel.name;
        return { rows: rows, sel: sel };
      }
    };
  };

  /* ================= 6 · ลูกค้าค้าส่ง ================= */
  var WS_ST = { 'เพิ่มขึ้น': ['var(--upbg)', 'var(--up)'], 'ลดลง': ['#FDF1D3', '#7A5300'], 'คงที่': ['var(--tint)', 'var(--muted)'], 'ลูกค้าใหม่': ['#E6E8F1', '#3E4A7C'],
    'หยุดซื้อ': ['var(--downbg)', 'var(--down)'], 'หยุดซื้อนานแล้ว': ['var(--tint)', 'var(--muted)'] };
  var Wholesale = function (Base) {
    return class extends Base {
      __filters() {
        var F = S.F, SS = S.S;
        return { rows: [[F.period(), F.from(), F.to(),
          { label: 'สถานะลูกค้า', options: function () { return [['', 'ทุกสถานะ']].concat(Object.keys(WS_ST).map(function (k) { return [k, k]; })); }, get: function () { return SS.wsStatus; }, set: function (v) { SS.wsStatus = v; } },
          { type: 'text', label: 'ค้นหาลูกค้า', placeholder: 'ชื่อหรือรหัสลูกค้า', get: function () { return SS.wsSearch; }, set: function (v) { SS.wsSearch = v; } }]],
          reset: function () { var d = S.defaults(); SS.preset = d.preset; SS.wsStatus = ''; SS.wsSearch = ''; }, note: F.note };
      }
      renderVals() {
        var th = this.__theme(), p = th.p, b = this.__calc();
        var cnt = { a: (b.tc / 1e6 * p).toFixed(2), b: S.fmt(b.kg * p), c: String(Math.round(b.nCust * p)) };
        var exp = {
          months: function () { S.csv('STAR_ค้าส่งรายเดือน.csv', ['เดือน', 'กก.', 'บาท (ไม่รวม VAT)', 'บาท/กก.', 'จำนวนลูกค้า'], b.months.map(function (m) { return [m.lbl, m.kgv.toFixed(2), m.amt.toFixed(2), m.ppkv == null ? '' : m.ppkv.toFixed(4), m.nc]; })); },
          customers: function () { S.csv('STAR_ลูกค้าค้าส่ง.csv', ['ลูกค้า', 'รหัส', 'สถานะ', b.label + ' (บาท)', b.cmpLabel + ' (บาท)', 'กก.', 'บาท/กก.', 'ซื้อครั้งล่าสุด', 'เดือนที่ซื้อ'], b.customers.map(function (c) { return [c.name, c.code, c.status, c.c.toFixed(2), c.p.toFixed(2), c.kgv.toFixed(2), c.ppkv == null ? '' : c.ppkv.toFixed(4), c.lastIso, c.span]; })); }
        };
        return Object.assign(b, th, { cnt: cnt, exp: exp, pt: stamp() });
      }
      __calc() {
        S.applyPreset();
        var SS = S.S, a = SS.from, bb = SS.to, cp = S.comparePeriod(a, bb), P = S.P, K = S.K, L = S.L;
        var ws = []; for (var i = 0; i < L.length; i++) { var l = L[i]; if (l[14] === 1 && P[l[3]].include) ws.push(l); }
        var nameOf = function (l) { return K[l[10]][1] || K[l[10]][0]; };
        var kgOf = function (l) { return (l[6] === 1 || l[6] === 2) && /กก|kg/i.test(P[l[3]].vol_unit || 'กก.') ? l[5] : 0; };
        /* ลูกค้า (รวมรหัสที่ชื่อเดียวกัน) */
        var C = new Map();
        ws.forEach(function (l) {
          var n = nameOf(l), c = C.get(n) || { name: n, codes: new Set(), c: 0, p: 0, kg: 0, kgp: 0, months: new Set(), first: 1e9, last: -1, byM: {} };
          c.codes.add(K[l[10]][0]); c.first = Math.min(c.first, l[0]); c.last = Math.max(c.last, l[0]);
          var m = S.dayDate(l[0]).getUTCMonth(); c.months.add(m); c.byM[m] = (c.byM[m] || 0) + l[7];
          if (l[0] >= a && l[0] <= bb) { c.c += l[7]; c.kg += kgOf(l); }
          if (cp && l[0] >= cp[0] && l[0] <= cp[1]) { c.p += l[7]; c.kgp += kgOf(l); }
          C.set(n, c);
        });
        var status = function (c) {
          if (c.c > 0 && c.p <= 0 && c.first >= (cp ? cp[0] : a)) return 'ลูกค้าใหม่';
          if (c.c <= 0 && c.p > 0) return 'หยุดซื้อ';
          if (c.c <= 0 && c.p <= 0) return 'หยุดซื้อนานแล้ว';
          var d = c.c - c.p;
          if (c.p > 0 && Math.abs(d) >= 50000 && Math.abs(d / c.p) >= 0.1) return d > 0 ? 'เพิ่มขึ้น' : 'ลดลง';
          return 'คงที่';
        };
        var all = Array.from(C.values()).map(function (c) { c.status = status(c); return c; });
        var q = (SS.wsSearch || '').trim().toLowerCase();
        var shown = all.filter(function (c) { return (!SS.wsStatus || c.status === SS.wsStatus) && (!q || c.name.toLowerCase().indexOf(q) >= 0 || Array.from(c.codes).join(' ').toLowerCase().indexOf(q) >= 0); });
        var shownSet = new Set(shown.map(function (c) { return c.name; }));
        var sumF = function (f) { return shown.reduce(function (s, c) { return s + f(c); }, 0); };
        var tc = sumF(function (c) { return c.c; }), tp = cp ? sumF(function (c) { return c.p; }) : null, kg = sumF(function (c) { return c.kg; }), kgp = sumF(function (c) { return c.kgp; });
        var ppk = kg ? tc / kg : null, ppkp = kgp ? tp / kgp : null;
        var nCust = shown.filter(function (c) { return c.c > 0; }).length, nCustP = shown.filter(function (c) { return c.p > 0; }).length, nYear = shown.length;
        /* ผู้ที่หยุดซื้อ: เฉลี่ย 3 เดือนก่อนเดือนที่ซื้อครั้งสุดท้าย */
        var lostAll = shown.filter(function (c) { return c.status === 'หยุดซื้อ' || c.status === 'หยุดซื้อนานแล้ว'; }).map(function (c) {
          var lm = S.dayDate(c.last).getUTCMonth(), xs = [lm - 3, lm - 2, lm - 1].filter(function (m) { return m >= 0; }).map(function (m) { return c.byM[m] || 0; });
          c.avg = xs.length ? xs.reduce(function (s, v) { return s + v; }, 0) / xs.length : (c.byM[lm] || 0); return c;
        }).sort(function (x, y) { return y.avg - x.avg; });
        var newN = shown.filter(function (c) { return c.status === 'ลูกค้าใหม่'; }).length;
        var label = S.rangeLabel(a, bb), cmpLabel = cp ? S.rangeLabel(cp[0], cp[1]) : 'ไม่มี';
        var k = {
          aD: S.diffTxt(tc, tp), aSt: "font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; color: " + (tc >= (tp || 0) ? '#9FE0A8' : '#FFB4A8'),
          bD: cp ? (kg >= kgp ? '▲ +' : '▼ −') + S.fmt(Math.abs(kg - kgp)) + ' กก.' + (kgp ? ' (' + S.pct(kg, kgp) + ')' : '') : '', bSt: NUM + 'font-weight: 500; color: ' + dcol(kg - kgp),
          bP: '· ' + (ppk == null ? '–' : S.fmt(ppk, 2)) + ' บาท/กก.' + (ppkp != null ? ' (เดิม ' + S.fmt(ppkp, 2) + ')' : ''),
          cNote: 'ช่วงเทียบ ' + nCustP + ' ราย · ทั้งปี ' + nYear + ' ราย', lostN: lostAll.length, newN: newN,
          lostAvg: lostAll.length ? 'เคยซื้อเฉลี่ยรวม ~' + S.mb(lostAll.reduce(function (s, c) { return s + c.avg; }, 0)) + ' บาท/เดือน' : 'ไม่มีลูกค้าหยุดซื้อในตัวกรอง'
        };
        /* รายเดือน */
        var last = S.dayDate(S.MAXDAY), nM = last.getUTCMonth() + 1, MM = [];
        for (var m = 0; m < nM; m++) MM.push({ kgv: 0, amt: 0, cust: new Set() });
        ws.forEach(function (l) { if (!shownSet.has(nameOf(l))) return; var mm = MM[S.dayDate(l[0]).getUTCMonth()]; mm.kgv += kgOf(l); mm.amt += l[7]; if (l[7] > 0) mm.cust.add(nameOf(l)); });
        var mxKg = Math.max.apply(null, MM.map(function (x) { return x.kgv; }).concat([1]));
        var e = Math.pow(10, Math.floor(Math.log10(mxKg / 4))), step = [1, 2, 2.5, 5, 10].map(function (x) { return x * e; }).find(function (s) { return s * 4 >= mxKg; }), topKg = step * 4;
        var A0 = S.dayDate(a).getUTCMonth(), B0 = S.dayDate(bb).getUTCMonth();
        var months = MM.map(function (x, i) {
          var none = x.kgv <= 0, sel = i >= A0 && i <= B0, pp = x.kgv ? x.amt / x.kgv : null;
          return { lbl: S.TH_M[i], kgv: x.kgv, amt: x.amt, ppkv: pp, nc: x.cust.size, price: pp == null ? '–' : S.fmt(pp, 2), cust: none ? 'ยังไม่มี' : x.cust.size + ' ราย', kg: none ? '' : S.fmt(x.kgv / 1000),
            tip: S.TH_M[i] + ' · ' + (none ? 'ไม่มีรายการ' : S.fmt(x.kgv) + ' กก. · ' + S.fmt(pp, 2) + ' บาท/กก. · ' + x.cust.size + ' ราย'),
            colStyle: 'flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; padding: 0 3px; ' + (sel ? 'background: var(--tint)' : ''),
            barStyle: none ? 'height: 6px; width: 6px; border-radius: 50%; background: #E07A2E; align-self: center' : 'height: ' + (x.kgv / topKg * 100).toFixed(1) + '%; background: ' + (sel ? 'var(--hero)' : '#C49A76') + '; border-radius: 3px 3px 0 0',
            lblStyle: 'font-size: 12px; ' + (sel ? 'color: var(--brand); font-weight: 600' : 'color: var(--muted)') };
        });
        var mAxis = [4, 3, 2, 1, 0].map(function (i) { return { v: S.fmt(step * i / 1000) }; });
        var noneM = months.filter(function (x) { return !x.kgv; }).map(function (x) { return x.lbl; });
        /* ผลต่าง = ปริมาณ + ราคา */
        var pvq = { title: 'ไม่มีช่วงเปรียบเทียบ', v: '–', p: '–', vSt: '', pSt: '', vBar: 'flex: 1; background: var(--tint); border-radius: 999px', pBar: 'display: none', note: '' };
        if (cp && kg && kgp) {
          var vol = (kg - kgp) * ppkp, prc = (ppk - ppkp) * kg;
          pvq = { title: 'ผลต่าง ' + S.sgn(tc - tp) + S.fmt(Math.abs(tc - tp)) + ' บาท มาจาก', v: S.sgn(vol) + S.fmt(Math.abs(vol)), p: S.sgn(prc) + S.fmt(Math.abs(prc)),
            vSt: "font-family: 'Outfit', sans-serif; font-weight: 500; color: " + dcol(vol), pSt: "font-family: 'Outfit', sans-serif; font-weight: 500; color: " + dcol(prc),
            vBar: 'flex: ' + Math.max(1, Math.abs(vol)).toFixed(0) + '; background: ' + dcol(vol) + '; border-radius: 999px', pBar: 'flex: ' + Math.max(1, Math.abs(prc)).toFixed(0) + '; background: ' + (prc >= 0 ? '#9FD9B2' : '#F0A79E') + '; border-radius: 999px',
            note: Math.abs(vol) >= Math.abs(prc) ? 'ผลต่างส่วนใหญ่มาจากปริมาณ ไม่ใช่ราคา' : 'ผลต่างส่วนใหญ่มาจากราคา ไม่ใช่ปริมาณ' };
        }
        var lost = lostAll.slice(0, 6).map(function (c) { return { name: c.name, last: S.thDate(c.last), avg: S.mb(c.avg) }; });
        var dn = shown.filter(function (c) { return c.status === 'ลดลง'; }).sort(function (x, y) { return (x.c - x.p) - (y.c - y.p); });
        var upc = shown.filter(function (c) { return c.status === 'เพิ่มขึ้น'; }).sort(function (x, y) { return (y.c - y.p) - (x.c - x.p); });
        var moves = dn.slice(0, 5).concat(upc.slice(0, 3)).map(function (c) { return { name: c.name, val: S.diffTxt(c.c, c.p), style: NUM + 'font-size: 13px; font-weight: 500; white-space: nowrap; color: ' + dcol(c.c - c.p) }; });
        var mn = S.TH_M;
        var order = { 'เพิ่มขึ้น': 1, 'ลดลง': 2, 'คงที่': 3, 'ลูกค้าใหม่': 0, 'หยุดซื้อ': 4, 'หยุดซื้อนานแล้ว': 5 };
        var customers = shown.slice().sort(function (x, y) { return (order[x.status] - order[y.status]) || (y.c - x.c) || (y.last - x.last); }).map(function (c) {
          var st = WS_ST[c.status], strip = [];
          for (var m = 0; m < nM; m++) strip.push('width: 12px; height: 14px; border-radius: 2px; background: ' + (c.months.has(m) ? (m >= A0 && m <= B0 ? 'var(--hero)' : '#C49A76') : 'var(--tint)'));
          var ms = Array.from(c.months).sort(function (x, y) { return x - y; });
          return { name: c.name, code: Array.from(c.codes).join(', '), status: c.status, c: c.c, p: c.p, kgv: c.kg, ppkv: c.kg ? c.c / c.kg : null, lastIso: S.iso(c.last),
            cur: c.c ? S.mb(c.c) : '–', prev: cp ? (c.p ? S.mb(c.p) : '–') : '–', diff: cp ? S.diffTxt(c.c, c.p) : '–', kg: c.kg ? S.fmt(c.kg) : '–', ppk: c.kg ? S.fmt(c.c / c.kg, 2) : '–',
            stStyle: 'font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background: ' + st[0] + '; color: ' + st[1],
            diffStyle: NUM + 'font-weight: 500; white-space: nowrap; color: ' + (c.c === c.p ? '#8C7B80' : dcol(c.c - c.p)), strip: strip,
            span: ms.length + ' เดือน · ล่าสุด ' + mn[S.dayDate(c.last).getUTCMonth()] };
        });
        return { tc: tc, kg: kg, nCust: nCust, k: k, months: months, mAxis: mAxis, mNote: 'พันกิโลกรัม · ตัวเลขใต้แท่ง = บาท/กก. · ' + (last.getUTCFullYear() + 543) + ' (ไม่ขึ้นกับช่วงเวลา)',
          mNote2: 'แถวล่างสุด = จำนวนลูกค้าที่ซื้อในเดือน' + (noneM.length ? ' · ' + noneM.join(', ') + ' ยังไม่มีรายการค้าส่ง (จุดส้ม — ไม่ใช่ยอดศูนย์ที่ยืนยันแล้ว)' : ''),
          pv: pvq, lost: lost, lostTitle: 'ลูกค้าหยุดซื้อ ' + lostAll.length + ' ราย' + (lostAll.length > lost.length ? ' (แสดง ' + lost.length + ' รายที่เคยซื้อมากสุด)' : ''),
          moves: moves, movesTitle: 'ซื้อลดลง ' + dn.length + ' ราย · เพิ่มขึ้น ' + upc.length + ' ราย', newNote: newN ? 'ลูกค้าใหม่ในช่วงนี้ ' + newN + ' ราย' : 'ไม่มีลูกค้าใหม่ในช่วงนี้',
          customers: customers, custNote: 'แถบ = เดือนที่มีการซื้อจริง · สีเข้ม = เดือนในช่วงที่เลือก · แสดง ' + shown.length + ' จาก ' + all.length + ' รายที่ซื้อในปี ' + (last.getUTCFullYear() + 543),
          stripHead: 'เดือนที่ซื้อ ม.ค.–' + S.TH_M[nM - 1], label: label, cmpLabel: cmpLabel };
      }
    };
  };

  /* ================= 2 · กำไรรายสถานี (ข้อมูล P&L รายเดือนจาก design/data/station_pl.json) ================= */
  var KIND = { oil: 'น้ำมัน · บาท/ลิตร', lpg: 'LPG ค้าปลีก · บาท/ลิตร', ws: 'LPG ค้าส่ง · บาท/กก.', none: 'ไม่มียอดขาย · มีค่าเช่า', hq: 'ส่วนกลาง' };
  var KIND_F = { oil: 'สถานีน้ำมัน', lpg: 'สถานี LPG ค้าปลีก', ws: 'LPG ค้าส่ง', none: 'สาขาไม่มียอดขาย', hq: 'ส่วนกลาง' };
  function plRows() {
    var d = S.data.station_pl || {}, out = [];
    Object.keys(d).forEach(function (k) { d[k].forEach(function (r) { out.push(Object.assign({ co: k.toUpperCase() }, r)); }); });
    out.forEach(function (r) {
      var rent = r.exp_5141001 || 0, opx = (r.opex_ap || 0) + (r.opex_exp || 0);
      r.rent = rent; r.opex = opx - rent; r.tr = r.transport || 0; r.sal = r.salary || 0;
      r.kind = /สำนักงานใหญ่|ไม่ระบุ/.test(r.unit) ? 'hq' : r.oil_l ? 'oil' : r.lpg_l ? 'lpg' : r.lpg_kg ? 'ws' : (r.rev || 0) === 0 ? 'none' : 'oil';
      r.m = r.oil_l ? (r.oil_rev - r.oil_cost) / r.oil_l : r.lpg_l ? (r.lpg_rev - r.lpg_cost) / r.lpg_l : r.lpg_kg ? (r.lpg_rev - r.lpg_cost) / r.lpg_kg : null;
    });
    return out;
  }
  var mLabel = function (ym) { var a = ym.split('-'); return S.TH_M[+a[1] - 1] + ' ' + (+a[0] + 543); };
  var Profit = function (Base) {
    return class extends Base {
      __filters() {
        var SS = S.S, months = Array.from(new Set(plRows().map(function (r) { return r.month; }))).sort().reverse();
        return { rows: [[
          { label: 'เดือน', options: function () { return months.map(function (m, i) { return [m, mLabel(m) + (i === 0 ? ' (ล่าสุด)' : '')]; }); }, get: function () { return SS.plMonth || months[0]; }, set: function (v) { SS.plMonth = v; } },
          { label: 'บริษัท', options: function () { return [['', 'STG + STP'], ['STG', 'STG'], ['STP', 'STP']]; }, get: function () { return SS.plCo; }, set: function (v) { SS.plCo = v; } },
          { label: 'ประเภทหน่วย', options: function () { return [['', 'ทุกประเภท']].concat(Object.keys(KIND_F).map(function (k) { return [k, KIND_F[k]]; })); }, get: function () { return SS.plKind; }, set: function (v) { SS.plKind = v; } }]],
          reset: function () { SS.plMonth = ''; SS.plCo = ''; SS.plKind = ''; },
          note: function () { return 'ข้อมูล P&L รายสถานีมีเฉพาะ ' + months.slice().reverse().map(mLabel).join(', ') + ' · เทียบกับเดือนก่อนหน้าที่มีข้อมูล · ส่วนกลางรวมค่าใช้จ่ายสำนักงานใหญ่และ Management fee'; } };
      }
      renderVals() {
        var th = this.__theme(), p = th.p, SS = S.S, all = plRows();
        var months = Array.from(new Set(all.map(function (r) { return r.month; }))).sort();
        var mo = SS.plMonth && months.indexOf(SS.plMonth) >= 0 ? SS.plMonth : months[months.length - 1], mp = months[months.indexOf(mo) - 1] || null;
        var keep = function (r) { return (!SS.plCo || r.co === SS.plCo) && (!SS.plKind || r.kind === SS.plKind); };
        var cur = all.filter(function (r) { return r.month === mo && keep(r); }), prev = all.filter(function (r) { return r.month === mp && keep(r); });
        var key = function (r) { return r.co + '|' + r.unit; }, P0 = new Map(prev.map(function (r) { return [key(r), r]; }));
        var sum = function (rows, f) { return rows.reduce(function (s, r) { return s + (f(r) || 0); }, 0); };
        var st = function (rows) { return rows.filter(function (r) { return r.kind !== 'hq'; }); }, hq = function (rows) { return rows.filter(function (r) { return r.kind === 'hq'; }); };
        var gp = sum(cur, function (r) { return r.gp; }), gpP = mp ? sum(prev, function (r) { return r.gp; }) : null;
        var con = sum(st(cur), function (r) { return r.contrib; }), conP = mp ? sum(st(prev), function (r) { return r.contrib; }) : null;
        var central = -sum(hq(cur), function (r) { return r.contrib; }), total = sum(cur, function (r) { return r.contrib; }), totalP = mp ? sum(prev, function (r) { return r.contrib; }) : null;
        var big = function (v) { return Math.abs(v) >= 1e6; }, val = function (v) { return big(v) ? (v / 1e6 * p).toFixed(2) : S.fmt(v * p); }, un = function (v) { return big(v) ? 'ล้านบาท' : 'บาท'; };
        var kp = [
          { label: 'กำไรขั้นต้น' + (SS.plCo ? ' ' + SS.plCo : ' STG + STP'), v: gp, sub: S.diffTxt(gp, gpP) + (mp ? ' · ' + mLabel(mp) + ' ' + S.mb(gpP) : ''), hero: true, up: gp >= (gpP || 0) },
          { label: 'กำไรส่วนเกินของสถานี', v: con, sub: mp ? 'เดิม ' + S.mb(conP) + ' (' + mLabel(mp) + ')' : '', up: con >= (conP || 0) },
          { label: 'ค่าใช้จ่ายส่วนกลาง', v: central, sub: hq(cur).length ? 'สำนักงานใหญ่ ' + hq(cur).map(function (r) { return r.co; }).join(' + ') : 'ไม่อยู่ในตัวกรอง', up: null },
          { label: 'ผลรวมหลังหักส่วนกลาง', v: total, sub: mp ? 'เดิม ' + (totalP < 0 ? 'ติดลบ ' : '') + S.mb(Math.abs(totalP)) : '', up: null, warn: total < 0 }
        ];
        var kpis = kp.map(function (k) { return { label: k.label, value: val(k.v), unit: un(k.v), sub: k.sub,
          style: 'flex: 1 1 240px; border-radius: 4px; padding: 20px 22px; display: flex; flex-direction: column; gap: 6px; ' + (k.hero ? 'background: var(--hero); color: #FFFFFF' : 'background: var(--card); border: 1px solid var(--line); border-top: 3px solid ' + (k.warn ? 'var(--down)' : 'var(--sand)') + '; color: var(--brand)'),
          labelStyle: 'font-size: 14px; color: ' + (k.hero ? 'var(--herotx)' : 'var(--muted)'), subStyle: 'font-size: 13px; color: ' + (k.hero ? (k.up ? '#9FE0A8' : '#FFB4A8') : (k.up === true ? 'var(--up)' : k.up === false ? 'var(--down)' : 'var(--muted)')) }; });
        /* สะพานกำไร */
        var trs = sum(st(cur), function (r) { return r.tr; }), ops = sum(st(cur), function (r) { return r.rent + r.opex; }), sals = sum(st(cur), function (r) { return r.sal; });
        var steps = [['กำไรขั้นต้น', gp, 'pos'], ['ค่าขนส่ง', trs, 'neg'], ['ค่าเช่าและค่าใช้จ่ายสถานี', ops, 'neg'], ['เงินเดือนพนักงานสถานี', sals, 'neg'], ['ค่าใช้จ่ายส่วนกลาง', central, 'neg'], ['ผลรวม', total, 'tot']];
        var mx = Math.max(gp, 1), run = gp;
        var bridge = steps.map(function (b, i) {
          var left, w;
          if (b[2] === 'pos') { left = 0; w = b[1]; } else if (b[2] === 'neg') { run -= b[1]; left = Math.max(0, run); w = b[1]; } else { left = Math.min(0, b[1]); w = Math.abs(b[1]); }
          var color = b[2] === 'pos' ? 'var(--brand)' : b[2] === 'neg' ? 'var(--sand)' : (b[1] >= 0 ? 'var(--up)' : 'var(--down)');
          return { label: b[0], val: (b[2] === 'neg' ? '−' : (b[1] < 0 ? '−' : '')) + S.fmt(Math.abs(b[1]) / 1e6, 2),
            labelStyle: 'font-size: 14px; ' + (b[2] === 'neg' ? 'color: var(--muted)' : 'font-weight: 600'),
            barStyle: 'position: absolute; top: 0; bottom: 0; left: ' + Math.max(0, left / mx * 100).toFixed(2) + '%; width: ' + Math.min(100, Math.max(0.6, Math.abs(w) / mx * 100)).toFixed(2) + '%; background: ' + color + '; border-radius: 3px; animation-delay: ' + (0.15 + i * 0.12) + 's',
            valStyle: NUM + 'font-size: 15px; font-weight: 500; text-align: right; color: ' + (b[2] === 'neg' || b[1] < 0 ? 'var(--down)' : 'var(--ink)') };
        });
        /* กำไรต่อลิตร สถานีน้ำมัน */
        var oils = cur.filter(function (r) { return r.kind === 'oil' && r.m != null; }).sort(function (a, b) { return a.co === b.co ? b.rev - a.rev : a.co < b.co ? 1 : -1; });
        var omMax = Math.max.apply(null, oils.map(function (r) { var q = P0.get(key(r)); return Math.max(r.m, q && q.m || 0); }).concat([0.1])) * 1.1;
        var oilMargins = oils.map(function (r, i) {
          var q = P0.get(key(r)), pm = q && q.m != null ? q.m : null, d = pm == null ? 0 : r.m - pm;
          return { co: r.co, name: r.unit, chip: chip(r.co), sep: pm == null ? '–' : pm.toFixed(2), oct: r.m.toFixed(2),
            valStyle: NUM + 'font-size: 14px; font-weight: 500; color: ' + (d < -0.05 ? 'var(--down)' : d > 0.05 ? 'var(--up)' : 'var(--ink)'),
            sepBar: 'height: 100%; width: ' + ((pm || 0) / omMax * 100).toFixed(1) + '%; background: var(--bar2); border-radius: 999px',
            octBar: 'height: 100%; width: ' + (r.m / omMax * 100).toFixed(1) + '%; background: ' + (d < -0.05 ? 'var(--down)' : 'var(--brand)') + '; border-radius: 999px' };
        });
        var worst = oilMargins.map(function (o, i) { return { o: o, d: o.sep === '–' ? 0 : +o.oct - +o.sep }; }).sort(function (a, b) { return a.d - b.d; })[0];
        var omNote = !oilMargins.length ? 'ไม่มีสถานีน้ำมันในตัวกรอง' : worst && worst.d < -0.05 ? 'กำไรต่อลิตรลดลงมากที่สุด: ' + worst.o.co + ' ' + worst.o.name + ' ' + worst.o.sep + ' → ' + worst.o.oct + ' บาท/ลิตร' : 'กำไรต่อลิตรของสถานีน้ำมันทรงตัวเมื่อเทียบเดือนก่อน';
        /* ตารางรายสถานี */
        var fmtI = function (v) { return v ? S.fmt(v) : '–'; };
        var cmax = Math.max.apply(null, cur.map(function (r) { return Math.abs(r.contrib); }).concat([1]));
        var noSal = [];
        var rows = cur.slice().sort(function (a, b) { return b.contrib - a.contrib; }).map(function (r) {
          var q = P0.get(key(r)), pm = q && q.m != null ? q.m : null, dl = r.m != null && pm != null ? r.m - pm : 0, c = r.contrib;
          if (!r.sal && (r.kind === 'lpg' || r.kind === 'oil')) noSal.push(r.unit);
          var w = (Math.abs(c) / cmax * 100).toFixed(1) + '%';
          return { co: r.co, chip: chip(r.co), name: r.unit, kindLabel: KIND[r.kind], rev: fmtI(r.rev), gp: fmtI(r.gp), revV: r.rev || 0, gpV: r.gp || 0, cV: c, cpV: q ? q.contrib : null, trV: r.tr, rentV: r.rent, opexV: r.opex, salV: r.sal, mV: r.m,
            m: r.m == null ? '–' : r.m.toFixed(2) + (pm == null ? '' : dl >= 0 ? ' ▲' : ' ▼'),
            mStyle: 'color: ' + (r.m == null ? 'var(--muted)' : dl < -0.05 ? 'var(--down)' : dl > 0.05 ? 'var(--up)' : 'var(--ink)'),
            tr: fmtI(r.tr), rent: fmtI(r.rent), opex: fmtI(r.opex), sal: r.sal ? S.fmt(r.sal) : (r.kind === 'lpg' || r.kind === 'oil' ? 'ยังไม่บันทึก' : '–'),
            salStyle: !r.sal && (r.kind === 'lpg' || r.kind === 'oil') ? 'color: var(--down); font-size: 12px' : '',
            posBar: c > 0 ? 'height: 100%; width: ' + w + '; background: var(--up); border-radius: 0 999px 999px 0' : 'display: none',
            negBar: c < 0 ? 'height: 100%; width: ' + w + '; background: var(--down); border-radius: 999px 0 0 999px' : 'display: none',
            c: (c < 0 ? '−' : '') + S.fmt(Math.abs(c)), cStyle: NUM + 'font-weight: 500; text-align: right; color: ' + (c < 0 ? 'var(--down)' : 'var(--ink)'),
            cSep: q ? (q.contrib < 0 ? '−' : '') + S.fmt(Math.abs(q.contrib)) : '–' };
        });
        var exportStations = function () { S.csv('STAR_กำไรรายสถานี_' + mo + '.csv', ['บริษัท', 'สถานี/หน่วย', 'ประเภท', 'ยอดขาย', 'กำไรขั้นต้น', 'บาท/หน่วย', 'ขนส่ง', 'ค่าเช่าที่ดิน', 'ค่าใช้จ่ายอื่น', 'เงินเดือน', 'กำไรส่วนเกิน', 'กำไรส่วนเกินเดือนก่อน'],
          rows.map(function (r) { return [r.co, r.name, r.kindLabel, r.revV.toFixed(2), r.gpV.toFixed(2), r.mV == null ? '' : r.mV.toFixed(4), r.trV.toFixed(2), r.rentV.toFixed(2), r.opexV.toFixed(2), r.salV.toFixed(2), r.cV.toFixed(2), r.cpV == null ? '' : r.cpV.toFixed(2)]; })); };
        return Object.assign({}, th, { kpis: kpis, bridge: bridge, oilMargins: oilMargins, rows: rows, decisions: (super.renderVals() || {}).decisions || [], exportStations: exportStations,
          hdr: mLabel(mo) + (mp ? ' เทียบ ' + mLabel(mp) : '') + ' · ' + (SS.plCo || 'STG และ STP') + (SS.plKind ? ' · ' + KIND_F[SS.plKind] : '') + ' · กำไรส่วนเกินก่อนค่าเสื่อมราคา',
          mLbl: mLabel(mo), omHint: 'บาท/ลิตร · แถบบาง = ' + (mp ? mLabel(mp) : '–') + ' · แถบหนา = ' + mLabel(mo), omNote: omNote, prevTh: mp ? S.TH_M[+mp.split('-')[1] - 1] : 'เดือนก่อน',
          salNote: noSal.length ? ' · เงินเดือน ' + mLabel(mo) + ' ของ ' + noSal.join(', ') + ' ยังไม่ถูกบันทึก' : '',
          pt: { stamp: 'ข้อมูลจริงจาก TRCloud · P&L ' + months.map(mLabel).join(', ') } });
      }
    };
  };

  /* ================= 3 · เงินทุนหมุนเวียน (ลูกหนี้/เจ้าหนี้รายเอกสาร data/wc.json) ================= */
  var BUCKETS = ['ยังไม่ครบกำหนด', '1–30 วัน', '31–60 วัน', '61–90 วัน', 'เกิน 90 วัน'];
  var B_COLOR = ['var(--bar2)', '#C49A76', '#D9822B', '#C2410C', 'var(--down)'];
  var bucketOf = function (od) { return od <= 0 ? 0 : od <= 30 ? 1 : od <= 60 ? 2 : od <= 90 ? 3 : 4; };
  var POS_AR = /เงินสด|บัตร|Promotion|คูปอง|Corpo?rate|Amazon|ลูกค้าทั่วไป|LINE MAN|QR|โอน|Prepaid|เครดิต/i;
  var Cash = function (Base) {
    return class extends Base {
      __filters() {
        var SS = S.S, docs = (S.data.wc || {}).docs || [];
        var types = Array.from(new Set(docs.map(function (d) { return d[4]; }).filter(Boolean))).sort();
        return { rows: [[
          { label: 'บริษัท', options: function () { return [['', 'STG + STP + TWP'], ['STG', 'STG'], ['STP', 'STP'], ['TWP', 'TWP']]; }, get: function () { return SS.cashCo; }, set: function (v) { SS.cashCo = v; } },
          { label: 'ฝั่ง', options: function () { return [['', 'ลูกหนี้ + เจ้าหนี้'], ['AR', 'ลูกหนี้ค้างรับ'], ['AP', 'เจ้าหนี้ค้างจ่าย']]; }, get: function () { return SS.cashSide; }, set: function (v) { SS.cashSide = v; } },
          { label: 'อายุหนี้', options: function () { return [['', 'ทุกช่วงอายุ']].concat(BUCKETS.map(function (b, i) { return [String(i), b]; })).concat([['od', 'เกินกำหนดทั้งหมด']]); }, get: function () { return SS.cashBucket; }, set: function (v) { SS.cashBucket = v; } },
          { label: 'ประเภทคู่ค้า', options: function () { return [['', 'ทุกประเภท']].concat(types.map(function (t) { return [t, t]; })); }, get: function () { return SS.cashType; }, set: function (v) { SS.cashType = v; } },
          { type: 'text', label: 'ค้นหาคู่ค้า', placeholder: 'ชื่อหรือรหัส', get: function () { return SS.cashSearch; }, set: function (v) { SS.cashSearch = v; } }]],
          reset: function () { SS.cashCo = SS.cashSide = SS.cashBucket = SS.cashType = SS.cashSearch = ''; },
          note: function () { return 'ยอดคงค้าง ณ ' + S.thDate(S.dayOf((S.data.wc || {}).asof || S.iso(S.MAXDAY))) + ' (หลังหัก ณ ที่จ่าย) · อายุนับจากวันครบกำหนด · ตัวกรองไม่มีช่วงเวลา เพราะเป็นยอดคงค้าง ณ วันที่ดึง'; } };
      }
      renderVals() {
        var th = this.__theme(), p = th.p, SS = S.S, W = S.data.wc || { docs: [] };
        var q = (SS.cashSearch || '').trim().toLowerCase();
        var docs = W.docs.filter(function (d) {
          if (SS.cashCo && d[0] !== SS.cashCo) return false;
          if (SS.cashType && d[4] !== SS.cashType) return false;
          if (SS.cashBucket === 'od' && d[7] <= 0) return false;
          if (SS.cashBucket !== '' && SS.cashBucket !== 'od' && bucketOf(d[7]) !== +SS.cashBucket) return false;
          if (q && (d[3] + ' ' + d[2]).toLowerCase().indexOf(q) < 0) return false;
          return true;
        });
        var ar = docs.filter(function (d) { return d[1] === 'AR'; }), ap = docs.filter(function (d) { return d[1] === 'AP'; });
        var showAR = SS.cashSide !== 'AP', showAP = SS.cashSide !== 'AR';
        var sum = function (rows) { return rows.reduce(function (s, d) { return s + d[6]; }, 0); };
        var cos = SS.cashCo ? [SS.cashCo] : ['STG', 'STP', 'TWP'];
        var byCo = function (rows) { return cos.map(function (c) { return c + ' ' + S.fmt(sum(rows.filter(function (d) { return d[0] === c; })) / 1e6, 2); }).join(' · ') + ' ล้าน'; };
        var pos = ar.filter(function (d) { return d[7] > 0 && POS_AR.test(d[3]); }), wsAr = ar.filter(function (d) { return /ค้าส่ง/.test(d[4]); });
        var apOld = ap.filter(function (d) { return d[7] > 60; });
        var kp = [];
        if (showAR) kp.push({ label: 'ลูกหนี้ค้างรับ', v: sum(ar), sub: byCo(ar), hero: true });
        if (showAR) kp.push({ label: 'ยอดขายหน้าสถานีที่ยังไม่บันทึกรับเงิน', v: sum(pos), sub: 'ลูกค้าเงินสด/บัตร/โปรโมชันที่เลยกำหนด · ควรเป็นศูนย์ภายในไม่กี่วัน', warn: sum(pos) > 0 });
        if (showAR) kp.push({ label: 'ลูกหนี้ค้าส่ง LPG', v: sum(wsAr), sub: 'เกินกำหนด ' + S.mb(sum(wsAr.filter(function (d) { return d[7] > 0; }))) + ' · เกิน 90 วัน ' + S.mb(sum(wsAr.filter(function (d) { return d[7] > 90; }))) });
        if (showAP) kp.push({ label: 'เจ้าหนี้ค้างจ่าย', v: sum(ap), sub: 'เกินกำหนด 60 วันขึ้นไป ' + S.mb(sum(apOld)), warn: sum(apOld) > 0, hero: !showAR });
        var kpis = kp.map(function (k) { return { label: k.label, value: S.fmt(k.v * p / 1e6, 2), sub: k.sub,
          style: 'flex: 1 1 240px; border-radius: 4px; padding: 20px 22px; display: flex; flex-direction: column; gap: 6px; ' + (k.hero ? 'background: var(--hero); color: #FFFFFF' : 'background: var(--card); border: 1px solid var(--line); border-top: 3px solid ' + (k.warn ? 'var(--down)' : 'var(--sand)') + '; color: var(--brand)'),
          labelStyle: 'font-size: 14px; color: ' + (k.hero ? 'var(--herotx)' : 'var(--muted)'), subStyle: 'font-size: 13px; color: ' + (k.hero ? 'var(--herotx)' : 'var(--muted)') }; });
        /* อายุหนี้ */
        var legend = BUCKETS.map(function (n, i) { return { label: n, dot: 'width: 12px; height: 12px; border-radius: 2px; background: ' + B_COLOR[i] }; });
        var ag = [];
        [['AR', 'ลูกหนี้', showAR], ['AP', 'เจ้าหนี้', showAP]].forEach(function (x) {
          if (!x[2]) return;
          cos.forEach(function (c) {
            var rows = docs.filter(function (d) { return d[1] === x[0] && d[0] === c; }); if (!rows.length) return;
            var b = [0, 0, 0, 0, 0]; rows.forEach(function (d) { b[bucketOf(d[7])] += d[6]; });
            var top = new Map(); rows.forEach(function (d) { top.set(d[3], (top.get(d[3]) || 0) + d[6]); });
            var t1 = Array.from(top).sort(function (a, b) { return b[1] - a[1]; })[0];
            ag.push({ label: x[1] + ' ' + c, b: b, tot: sum(rows), note: rows.length + ' เอกสาร · มากสุด ' + (t1 ? t1[0] + ' ' + S.mb(t1[1]) : '–') });
          });
        });
        var agMax = Math.max.apply(null, ag.map(function (a) { return Math.abs(a.tot); }).concat([1]));
        var aging = ag.map(function (a, i) { return { label: a.label, note: a.note, total: S.fmt(a.tot / 1e6, 2),
          trackStyle: 'display: flex; height: 28px; border-radius: 3px; overflow: hidden; width: ' + Math.max(1, Math.abs(a.tot) / agMax * 100).toFixed(1) + '%; animation-delay: ' + (0.2 + i * 0.12) + 's',
          segs: a.b.map(function (v, j) { return { tip: BUCKETS[j] + ' ' + S.fmt(v) + ' บาท', style: 'height: 100%; flex: ' + Math.max(v, 0) + ' 0 0; background: ' + B_COLOR[j] }; }) }; });
        /* ลูกหนี้ค้าส่ง × แนวโน้มการซื้อ (เดือนล่าสุดที่ครบเทียบเดือนก่อน) */
        var lm = S.dayDate(S.MAXDAY), y = lm.getUTCFullYear(), m = lm.getUTCMonth() - 1, r1 = S.monthRange(y, m), r0 = S.monthRange(y, m - 1);
        var buy = new Map(); S.L.forEach(function (l) { if (l[14] !== 1 || !S.P[l[3]].include) return; var code = S.K[l[10]][0], b = buy.get(code) || [0, 0, -1];
          if (l[0] >= r1[0] && l[0] <= r1[1]) b[0] += l[7]; if (l[0] >= r0[0] && l[0] <= r0[1]) b[1] += l[7]; b[2] = Math.max(b[2], l[0]); buy.set(code, b); });
        var wsC = new Map(); wsAr.forEach(function (d) { var c = wsC.get(d[2]) || { code: d[2], name: d[3], tot: 0, nd: 0, od: 0, old: 0, mx: 0, n: 0 }; c.tot += d[6]; c.n++; c.mx = Math.max(c.mx, d[7]);
          if (d[7] <= 0) c.nd += d[6]; else if (d[7] <= 90) c.od += d[6]; else c.old += d[6]; wsC.set(d[2], c); });
        var trColor = { d: ['var(--downbg)', 'var(--down)'], u: ['var(--upbg)', 'var(--up)'], n: ['var(--tint)', 'var(--muted)'], x: ['var(--down)', '#FFFFFF'] };
        var ws = Array.from(wsC.values()).sort(function (a, b) { return b.tot - a.tot; }).map(function (c) {
          var b = buy.get(c.code), t;
          if (!b) t = ['ไม่มีการซื้อปีนี้', 'x']; else if (!b[0] && !b[1]) t = ['หยุดซื้อตั้งแต่ ' + S.TH_M[S.dayDate(b[2]).getUTCMonth()], 'x'];
          else if (!b[1]) t = ['ซื้อเพิ่ม (ใหม่)', 'u']; else { var ch = (b[0] - b[1]) / b[1] * 100; t = Math.abs(ch) < 10 ? ['คงที่', 'n'] : ch > 0 ? ['ซื้อเพิ่ม +' + S.fmt(ch, 1) + '%', 'u'] : ['ซื้อลดลง −' + S.fmt(-ch, 1) + '%', 'd']; }
          return { code: c.code, name: c.name, docs: c.n, trend: t[0], totV: c.tot, odV: c.od + c.old, mxV: c.mx,
            trStyle: 'font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background: ' + trColor[t[1]][0] + '; color: ' + trColor[t[1]][1],
            total: S.fmt(c.tot), nd: c.nd ? S.fmt(c.nd) : '–', od: c.od + c.old ? S.fmt(c.od + c.old) : '–', odStyle: c.od + c.old ? 'color: var(--down); font-weight: 500' : 'color: var(--muted)',
            mx: c.mx > 0 ? c.mx + ' วัน' : '–', mxStyle: c.mx > 90 ? 'color: var(--down); font-weight: 600' : 'color: var(--muted)',
            ndBar: 'height: 100%; flex: ' + Math.max(0, c.nd) + ' 0 0; background: var(--bar2)', odBar: 'height: 100%; flex: ' + Math.max(0, c.od) + ' 0 0; background: #D9822B', oldBar: 'height: 100%; flex: ' + Math.max(0, c.old) + ' 0 0; background: var(--down)' };
        });
        /* เจ้าหนี้รายสำคัญ */
        var tagStyle = { 'การค้า': ['var(--tint)', 'var(--muted)'], 'บริษัทที่เกี่ยวข้อง': ['#FDF1D3', '#7A5300'], 'ต้องกระทบยอด': ['var(--downbg)', 'var(--down)'], 'ภาษี / ประกันสังคม': ['var(--downbg)', 'var(--down)'], 'อื่น ๆ': ['var(--tint)', 'var(--muted)'] };
        var apC = new Map(); (showAP ? ap : []).forEach(function (d) { var k = d[0] + '|' + d[2]; var c = apC.get(k) || { co: d[0], code: d[2], name: d[3], ctype: d[4], tot: 0, od: 0, mx: 0 }; c.tot += d[6]; if (d[7] > 0) c.od += d[6]; c.mx = Math.max(c.mx, d[7]); apC.set(k, c); });
        var apRows = Array.from(apC.values()).sort(function (a, b) { return Math.abs(b.tot) - Math.abs(a.tot); }).slice(0, 15).map(function (c) {
          var tag = /สรรพากร|ประกันสังคม/.test(c.name) ? 'ภาษี / ประกันสังคม' : /เกี่ยวข้อง/.test(c.ctype) ? 'บริษัทที่เกี่ยวข้อง' : c.mx > 180 ? 'ต้องกระทบยอด' : /การค้า/.test(c.ctype) ? 'การค้า' : 'อื่น ๆ';
          var ts = tagStyle[tag];
          return { co: c.co, chip: chip(c.co), name: c.name + ' (' + c.code + ')', tag: tag, totV: c.tot, odV: c.od, mxV: c.mx, total: S.fmt(c.tot), od: c.od ? S.fmt(c.od) : '–', mx: c.mx > 0 ? c.mx + ' วัน' : '–',
            tagStyle: 'font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background: ' + ts[0] + '; color: ' + ts[1], odStyle: c.od ? 'color: var(--down); font-weight: 500' : 'color: var(--muted)' };
        });
        var asofTh = S.thDate(S.dayOf(W.asof || S.iso(S.MAXDAY)));
        var exp = {
          aging: function () { S.csv('STAR_อายุลูกหนี้เจ้าหนี้.csv', ['บริษัท', 'ฝั่ง', 'รหัส', 'คู่ค้า', 'ประเภทคู่ค้า', 'เลขเอกสาร', 'วันที่เอกสาร', 'ครบกำหนด', 'เกินกำหนด (วัน)', 'ช่วงอายุ', 'ยอดคงค้าง'], docs.filter(function (d) { return (d[1] === 'AR' && showAR) || (d[1] === 'AP' && showAP); }).map(function (d) { return [d[0], d[1] === 'AR' ? 'ลูกหนี้' : 'เจ้าหนี้', d[2], d[3], d[4], d[8], d[9], d[5], d[7], BUCKETS[bucketOf(d[7])], d[6].toFixed(2)]; })); },
          ws: function () { S.csv('STAR_ลูกหนี้ค้าส่ง.csv', ['รหัส', 'ลูกค้า', 'เอกสาร', 'แนวโน้มการซื้อ', 'ยอดค้างรวม', 'เกินกำหนด', 'เกินนานสุด (วัน)'], ws.map(function (w) { return [w.code, w.name, w.docs, w.trend, w.totV.toFixed(2), w.odV.toFixed(2), w.mxV]; })); },
          ap: function () { S.csv('STAR_เจ้าหนี้รายสำคัญ.csv', ['บริษัท', 'เจ้าหนี้', 'กลุ่ม', 'ยอดค้าง', 'เกินกำหนด', 'เกินนานสุด (วัน)'], apRows.map(function (r) { return [r.co, r.name, r.tag, r.totV.toFixed(2), r.odV.toFixed(2), r.mxV]; })); }
        };
        return Object.assign({}, th, { kpis: kpis, legend: legend, aging: aging, ws: ws, ap: apRows, exp: exp, decisions: (super.renderVals() || {}).decisions || [],
          hdr: 'ลูกหนี้ค้างรับและเจ้าหนี้ค้างจ่าย ณ ' + asofTh + ' · ' + (SS.cashCo || 'STG STP และ TWP'),
          wsNote: 'STG · ' + S.mb(sum(wsAr)) + ' บาท · แนวโน้มการซื้อ = ' + S.TH_M[m < 0 ? 11 : m] + ' เทียบ ' + S.TH_M[m - 1 < 0 ? 11 : m - 1] + ' · ลูกค้าที่ซื้อลดลงแต่ยังมียอดค้าง ควรติดตามก่อน',
          asofTh: asofTh, pt: { stamp: 'ข้อมูลจริงจาก TRCloud · ยอดคงค้าง ณ ' + asofTh } });
      }
    };
  };

  /* ================= 7 · Operation (เป้าจากไฟล์ Operation) — กรองบริษัท/ธุรกิจ/สถานะเทียบเป้า ================= */
  /* แถวสาขาในดีไซน์: [AM, สาขา, บริษัท, ธุรกิจ, หน่วย, เป้า, MTD, วัน, pace, ...] — ตรรกะคำนวณอยู่ในไฟล์ดีไซน์ ส่วนนี้คัดแถวตามตัวกรอง */
  window.STAR_OPS_KEEP = function (r) {
    var SS = S.S; if (!SS) return true;
    if (SS.opsCo && r[2] !== SS.opsCo) return false;
    if (SS.opsKind && r[3] !== SS.opsKind) return false;
    if (SS.opsStatus === 'risk' && !(r[8] < 0.9)) return false;
    if (SS.opsStatus === 'watch' && !(r[8] >= 0.9 && r[8] < 1)) return false;
    if (SS.opsStatus === 'ok' && !(r[8] >= 1)) return false;
    return true;
  };
  var Ops = function (Base) {
    return class extends Base {
      __filters() {
        var SS = S.S;
        return { rows: [[
          { label: 'บริษัท', options: function () { return [['', 'ทุกบริษัท'], ['STG', 'STG'], ['STP', 'STP'], ['TWP', 'TWP']]; }, get: function () { return SS.opsCo; }, set: function (v) { SS.opsCo = v; } },
          { label: 'ธุรกิจ', options: function () { return [['', 'ทุกธุรกิจ'], ['LPG', 'LPG'], ['น้ำมัน', 'น้ำมัน'], ['NGV', 'NGV'], ['Café Amazon', 'Café Amazon'], ['7-Eleven', '7-Eleven']]; }, get: function () { return SS.opsKind; }, set: function (v) { SS.opsKind = v; } },
          { label: 'สถานะเทียบเป้า', options: function () { return [['', 'ทุกสถานะ'], ['risk', 'ต่ำกว่า 90% ของเป้า'], ['watch', '90–99% ของเป้า'], ['ok', 'ถึงเป้าแล้ว (≥100%)']]; }, get: function () { return SS.opsStatus; }, set: function (v) { SS.opsStatus = v; } }]],
          reset: function () { SS.opsCo = SS.opsKind = SS.opsStatus = ''; },
          note: function () { return 'ใช้ร่วมกับปุ่มเลือกผู้จัดการเขตด้านล่าง · เป้าและ AM จากไฟล์ Operation · ยอด MTD จาก TRCloud ถึง 12 พ.ย. (บางสาขาใช้ตัวเลข Excel 8 พ.ย.) · ถ้าไม่พบสาขาตามตัวกรอง จะแสดงทุกสาขาของผู้จัดการเขตนั้น'; } };
      }
    };
  };

  return { 'Main.dc.html': Main, 'Products.dc.html': Products, 'Stations.dc.html': Stations, 'Wholesale.dc.html': Wholesale, 'Profit.dc.html': Profit, 'Cash.dc.html': Cash, 'Ops.dc.html': Ops };
})();
