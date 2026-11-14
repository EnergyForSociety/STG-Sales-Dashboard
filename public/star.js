/* STAR Dashboard — ตัวคำนวณกลาง + ตัวกรองที่ใช้ร่วมกันทุกหน้า
   ข้อมูล (model.json ฯลฯ) มาจาก bundle ที่ถอดรหัสแล้ว ไฟล์นี้ไม่มีตัวเลขธุรกิจ
   รูปแบบบรรทัด: [day, co, unit, product, doc, qty, volOk(1 หน่วยถูก/2 ว่าง), amt, cost, status, contact, isCN, itemId, vat, channel(0 ค้าปลีก/1 ค้าส่ง)] */
'use strict';
window.STAR = (function () {
  var X = {}; // datasets: model, station_pl, wc, ops, yoy
  var M, U, P, K, L, CO, EPOCH, MAXDAY;
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var GROUPS = ['น้ำมัน', 'LPG', 'NGV', 'Non-Oil', 'อื่น ๆ / รอจัดประเภท'];
  var CH = ['ค้าปลีก', 'ค้าส่ง'];
  var CO_TH = { STG: 'บจ. สตาร์ แก๊ส', STP: 'บจ. สตาร์ ปิโตรเลียม พลัส', TWP: 'บจ. ธวัชภิญโญ' };
  var CO_COLOR = { STG: '#6DC24D', STP: '#F5B82E', TWP: '#3E4A7C' };
  var NONSALES_CONTACT = /เงินสด|Promotion|Amazon|Corpo?rate|ร้านเช่า|ลูกค้าทั่วไป|ลูกหนี้การค้า ?-|ลูกค้า-|LINE MAN|บายซี่บี/i;

  /* ---------- วันที่ ---------- */
  var dayDate = function (d) { return new Date(EPOCH.getTime() + d * 864e5); };
  var iso = function (d) { return dayDate(d).toISOString().slice(0, 10); };
  var dayOf = function (s) { return Math.round((new Date(s + 'T00:00:00Z') - EPOCH) / 864e5); };
  var thDate = function (d) { var x = dayDate(d); return x.getUTCDate() + ' ' + TH_M[x.getUTCMonth()] + ' ' + (x.getUTCFullYear() + 543); };
  var thMonth = function (y, m) { return TH_M[m] + ' ' + String(y + 543).slice(2); };
  function monthRange(y, m) { return [dayOf(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)), dayOf(new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10))]; }
  function rangeLabel(a, b) {
    var A = dayDate(a), B = dayDate(b);
    var endB = new Date(Date.UTC(B.getUTCFullYear(), B.getUTCMonth() + 1, 0)).getUTCDate();
    if (A.getUTCDate() === 1 && B.getUTCDate() === endB) {
      if (A.getUTCMonth() === B.getUTCMonth() && A.getUTCFullYear() === B.getUTCFullYear()) return TH_M[A.getUTCMonth()] + ' ' + (A.getUTCFullYear() + 543);
      return TH_M[A.getUTCMonth()] + '–' + TH_M[B.getUTCMonth()] + ' ' + (B.getUTCFullYear() + 543);
    }
    if (A.getUTCMonth() === B.getUTCMonth()) return A.getUTCDate() + '–' + B.getUTCDate() + ' ' + TH_M[B.getUTCMonth()] + ' ' + (B.getUTCFullYear() + 543);
    return thDate(a) + ' – ' + thDate(b);
  }
  function rangeLabelLong(a, b) {
    var A = dayDate(a), B = dayDate(b);
    if (A.getUTCMonth() === B.getUTCMonth()) return A.getUTCDate() + '–' + B.getUTCDate() + ' ' + TH_M[B.getUTCMonth()] + ' ' + (B.getUTCFullYear() + 543);
    return thDate(a) + ' – ' + thDate(b);
  }

  /* ---------- ตัวเลข ---------- */
  var fmt = function (v, dp) { dp = dp || 0; return v == null || isNaN(v) ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); };
  var mb = function (v) { return v == null ? '–' : (Math.abs(v) >= 1e6 ? fmt(v / 1e6, 2) + ' ล้าน' : fmt(v, 0)); };
  var M2 = function (v) { return fmt(v / 1e6, 2); };
  var sgn = function (v) { return v > 0 ? '+' : v < 0 ? '−' : '±'; };
  var pct = function (c, p) { return p ? sgn(c - p) + fmt(Math.abs((c - p) / p * 100), 1) + '%' : 'N/A'; };
  /* "▲ +2.13 ล้าน (+5.1%)" แบบดีไซน์ */
  function diffTxt(c, p, unit) {
    if (p == null) return 'ไม่มีช่วงเปรียบเทียบ';
    var d = c - p, up = d >= 0;
    return (up ? '▲ ' : '▼ ') + sgn(d) + (unit ? fmt(Math.abs(d), 0) + ' ' + unit : mb(Math.abs(d))) + (p ? ' (' + pct(c, p) + ')' : '');
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- ตัวกรอง (ใช้ร่วมกันทุกหน้า เก็บใน sessionStorage) ---------- */
  var KEY = 'star-filters-v1';
  var S = null;
  function defaults() {
    return { preset: 'lastmonth', from: 0, to: 0, cos: ['STG', 'STP', 'TWP'], channel: '', station: '', biz: '', group: '', product: '',
      wsStatus: '', wsSearch: '', plMonth: '', plCo: '', plKind: '', cashCo: '', cashSide: '', cashBucket: '', cashType: '', cashSearch: '', opsCo: '', opsKind: '', opsStatus: '' };
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function load() { try { var s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && typeof s === 'object' ? Object.assign(defaults(), s) : null; } catch (e) { return null; } }
  function lastFullMonth() {
    var md = dayDate(MAXDAY), y = md.getUTCFullYear(), m = md.getUTCMonth();
    var end = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    if (md.getUTCDate() !== end) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
    return monthRange(y, m);
  }
  function applyPreset() {
    var md = dayDate(MAXDAY), r;
    if (S.preset === 'lastmonth') r = lastFullMonth();
    else if (S.preset === 'mtd') r = [monthRange(md.getUTCFullYear(), md.getUTCMonth())[0], MAXDAY];
    else if (S.preset === 'ytd') r = [dayOf(md.getUTCFullYear() + '-01-01'), MAXDAY];
    else if (/^m\d+$/.test(S.preset)) { var mi = +S.preset.slice(1); r = monthRange(md.getUTCFullYear(), mi); r[1] = Math.min(r[1], MAXDAY); }
    if (r) { S.from = r[0]; S.to = r[1]; }
    S.from = Math.max(0, Math.min(S.from, MAXDAY)); S.to = Math.max(S.from, Math.min(S.to, MAXDAY));
  }
  /* ช่วงเปรียบเทียบ: เริ่มวันที่ 1 → วันเดียวกันของเดือนก่อนหน้า (ยาวเท่ากัน) · อื่น ๆ → ช่วงยาวเท่ากันก่อนหน้า */
  function comparePeriod(a, b) {
    var A = dayDate(a), B = dayDate(b), ca, cb;
    if (A.getUTCDate() === 1) {
      var months = (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + B.getUTCMonth() - A.getUTCMonth() + 1;
      var ys = new Date(Date.UTC(A.getUTCFullYear(), A.getUTCMonth() - months, 1));
      var endOfB = new Date(Date.UTC(B.getUTCFullYear(), B.getUTCMonth() + 1, 0)).getUTCDate();
      var bEnd = new Date(Date.UTC(B.getUTCFullYear(), B.getUTCMonth() - months + 1, 0));
      var be = B.getUTCDate() === endOfB ? bEnd : new Date(Date.UTC(B.getUTCFullYear(), B.getUTCMonth() - months, Math.min(B.getUTCDate(), bEnd.getUTCDate())));
      ca = Math.round((ys - EPOCH) / 864e5); cb = Math.round((be - EPOCH) / 864e5);
    } else { var n = b - a + 1; ca = a - n; cb = a - 1; }
    if (ca < 0) return null;
    return [ca, cb];
  }

  /* ---------- เลือกบรรทัด ---------- */
  function lineOK(l, ig) {
    ig = ig || {};
    var u = U[l[2]], p = P[l[3]];
    if (!p.include) return false;
    if (!ig.co && S.cos.indexOf(CO[l[1]]) < 0) return false;
    if (!ig.station && S.station && (S.station.slice(0, 2) === 'u:' ? l[2] !== +S.station.slice(2) : u.station_id !== S.station)) return false;
    if (!ig.biz && S.biz && u.unit_name !== S.biz) return false;
    if (!ig.group && S.group && p.group !== S.group) return false;
    if (!ig.channel && S.channel && CH[l[14]] !== S.channel) return false;
    if (!ig.product && S.product && p.co + '|' + p.id !== S.product) return false;
    return true;
  }
  function sel(a, b, ig) { var r = []; if (a == null) return r; for (var i = 0; i < L.length; i++) { var l = L[i]; if (l[0] >= a && l[0] <= b && lineOK(l, ig)) r.push(l); } return r; }
  function sum(rows, f) { var s = 0; for (var i = 0; i < rows.length; i++) s += f ? f(rows[i]) : rows[i][7]; return s; }
  function groupBy(rows, kf, vf) { var m = new Map(); for (var i = 0; i < rows.length; i++) { var l = rows[i], k = kf(l); m.set(k, (m.get(k) || 0) + (vf ? vf(l) : l[7])); } return m; }
  var grp = function (l) { return P[l[3]].group; };
  var co = function (l) { return CO[l[1]]; };
  var unitLabel = function (u) { return u.station_name + (u.unit_name && ['ไม่ระบุสถานี', 'LPG'].indexOf(u.unit_name) < 0 ? ' · ' + u.unit_name : ''); };

  /* ปัจจุบัน/ช่วงเปรียบเทียบตามตัวกรอง */
  function ctx(ig) {
    applyPreset();
    var a = S.from, b = S.to, cp = comparePeriod(a, b);
    var cur = sel(a, b, ig), cmp = cp ? sel(cp[0], cp[1], ig) : [];
    return { a: a, b: b, cp: cp, cur: cur, cmp: cmp, tc: sum(cur), tp: cp ? sum(cmp) : null,
      label: rangeLabel(a, b), cmpLabel: cp ? rangeLabel(cp[0], cp[1]) : 'ไม่มี (ข้อมูลเริ่ม ม.ค. 2569)',
      scope: rangeLabelLong(a, b) + (cp ? ' เทียบ ' + rangeLabelLong(cp[0], cp[1]) : ''),
      partial: b === MAXDAY && dayDate(b).getUTCDate() !== new Date(Date.UTC(dayDate(b).getUTCFullYear(), dayDate(b).getUTCMonth() + 1, 0)).getUTCDate() };
  }
  /* ยอดรายเดือนทั้งปี (ไม่ขึ้นกับช่วงเวลา แต่ขึ้นกับตัวกรองอื่น) */
  function monthly(keyf, keys) {
    var md = dayDate(MAXDAY), n = md.getUTCMonth() + 1, out = [];
    for (var m = 0; m < n; m++) out.push({ m: m, label: TH_M[m], vals: keys.map(function () { return 0; }), total: 0, qty: 0 });
    for (var i = 0; i < L.length; i++) {
      var l = L[i]; if (!lineOK(l)) continue;
      var mi = dayDate(l[0]).getUTCMonth(), r = out[mi]; if (!r) continue;
      r.total += l[7];
      if (keyf) { var k = keys.indexOf(keyf(l)); if (k >= 0) r.vals[k] += l[7]; }
    }
    return out;
  }
  function priceVolume(cur, cmp) {
    var vol = function (l) { return l[6] === 1 || l[6] === 2; };
    var agg = function (rows) { var m = new Map(), tot = 0, cov = 0; rows.forEach(function (l) { tot += l[7]; if (!vol(l)) return; cov += l[7]; var k = l[3]; var a = m.get(k) || [0, 0]; a[0] += l[7]; a[1] += l[5]; m.set(k, a); }); return { m: m, tot: tot, cov: cov }; };
    var A = agg(cur), B = agg(cmp);
    if (!A.tot || A.cov / A.tot < .8 || !B.tot || B.cov / B.tot < .8) return null;
    var v = 0, p = 0;
    A.m.forEach(function (x, k) { var b = B.m.get(k); if (!b || !b[1] || !x[1]) return; var p0 = b[0] / b[1], p1 = x[0] / x[1]; v += (x[1] - b[1]) * p0; p += (p1 - p0) * x[1]; });
    var d = sum(cur) - sum(cmp);
    return { vol: v, price: p, other: d - v - p, cov: A.cov / A.tot };
  }

  /* ---------- สถานะข้อมูลรายหน่วย ---------- */
  var unitDays, unitLast, unitFirst;
  function buildUnitDays() {
    unitDays = U.map(function () { return new Set(); }); unitLast = U.map(function () { return -1; }); unitFirst = U.map(function () { return 1e9; });
    L.forEach(function (l) { if (!P[l[3]].include) return; unitDays[l[2]].add(l[0]); unitLast[l[2]] = Math.max(unitLast[l[2]], l[0]); unitFirst[l[2]] = Math.min(unitFirst[l[2]], l[0]); });
  }
  function isDaily(ui, end) { var n = 0; for (var d = Math.max(0, end - 59); d <= end; d++) if (unitDays[ui].has(d)) n++; return n >= (U[ui].expected_source === 'API POS' ? 0.8 : 0.95) * Math.min(60, end + 1); }
  function unitGaps(ui, a, b) {
    if (unitLast[ui] < 0 || !isDaily(ui, Math.min(b, MAXDAY))) return [];
    var miss = []; for (var d = Math.max(a, unitFirst[ui]); d <= Math.min(b, MAXDAY); d++) if (!unitDays[ui].has(d)) miss.push(d);
    return miss;
  }
  function unitDaysIn(ui, a, b) { var n = 0; for (var d = a; d <= b; d++) if (unitDays[ui].has(d)) n++; return n; }

  /* ---------- ประเด็นสำหรับผู้บริหาร (กฎคงที่ ตรวจย้อนได้) ---------- */
  var TEAM = { 'น้ำมัน': 'ทีมปฏิบัติการสถานี (น้ำมัน)', 'LPG': 'ทีมปฏิบัติการสถานี (LPG)', 'NGV': 'ทีมปฏิบัติการ NGV / TWP', 'Non-Oil': 'ทีม Non-Oil', 'อื่น ๆ / รอจัดประเภท': 'ฝ่ายบัญชี' };
  function insights(c) {
    var out = [], cur = c.cur, cmp = c.cmp, tc = c.tc, tp = c.tp || 0, cp = c.cp, scope = c.scope;
    if (cp) {
      var g1 = groupBy(cur, grp), g0 = groupBy(cmp, grp);
      var gs = GROUPS.map(function (g) { return { g: g, c: g1.get(g) || 0, p: g0.get(g) || 0 }; }).map(function (r) { r.d = r.c - r.p; return r; }).filter(function (r) { return r.d; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); });
      var top = gs[0];
      if (top) {
        var pv = priceVolume(cur.filter(function (l) { return grp(l) === top.g; }), cmp.filter(function (l) { return grp(l) === top.g; }));
        out.push({ imp: Math.abs(top.d), up: top.d >= 0, title: 'กลุ่ม' + top.g + (top.d >= 0 ? 'เพิ่มขึ้น' : 'ลดลง') + 'มากที่สุด' + (pv ? (Math.abs(pv.price) > Math.abs(pv.vol) ? ' ส่วนใหญ่มาจากราคา' : ' ส่วนใหญ่มาจากปริมาณ') : ''),
          fig: sgn(top.d) + mb(Math.abs(top.d)) + ' (' + pct(top.c, top.p) + ')',
          found: pv ? 'ผลจากปริมาณ ' + sgn(pv.vol) + mb(Math.abs(pv.vol)) + ' · ผลจากราคา ' + sgn(pv.price) + mb(Math.abs(pv.price)) + ' · สินค้าใหม่/หยุดขายและส่วนที่ไม่มีปริมาณ ' + sgn(pv.other) + mb(Math.abs(pv.other)) : 'ยังแยกผลจากปริมาณและราคาไม่ได้ เพราะรายการที่มีหน่วยปริมาณชัดเจนไม่ถึง 80% ของยอด',
          scope: scope, impact: 'กลุ่มนี้คิดเป็น ' + fmt(tc ? top.c / tc * 100 : 0, 1) + '% ของยอดในตัวกรอง',
          action: pv && Math.abs(pv.price) > Math.abs(pv.vol) ? 'ดูกำไรต่อหน่วยในหน้ากำไรรายสถานีควบคู่ เพราะราคาขายที่สูงขึ้นไม่ได้แปลว่ากำไรเพิ่ม' : 'ดูปริมาณรายสถานีในหน้าบริษัทและสถานีเพื่อหาสถานีที่ปริมาณเปลี่ยนมาก', owner: TEAM[top.g] || 'ทีมปฏิบัติการสถานี' });
      }
      var byU = groupBy(cur, function (l) { return l[2]; }), byUp = groupBy(cmp, function (l) { return l[2]; });
      var keys = new Set(Array.from(byU.keys()).concat(Array.from(byUp.keys())));
      var rows = Array.from(keys).map(function (ui) { var r = { ui: ui, c: byU.get(ui) || 0, p: byUp.get(ui) || 0 }; r.d = r.c - r.p; r.gap = unitGaps(ui, c.a, c.b).length + unitGaps(ui, cp[0], cp[1]).length; return r; });
      var neg = rows.filter(function (r) { return r.d < 0; }).sort(function (x, y) { return x.d - y.d; })[0], pos = rows.filter(function (r) { return r.d > 0; }).sort(function (x, y) { return y.d - x.d; })[0];
      [pos, neg].filter(Boolean).forEach(function (r) {
        var u = U[r.ui], days = c.b - c.a + 1, have = unitDaysIn(r.ui, c.a, c.b);
        out.push({ imp: Math.abs(r.d), up: r.d >= 0, title: u.company + ' · ' + unitLabel(u) + ' ยอดขาย' + (r.d < 0 ? 'ลดลง' : 'เพิ่มขึ้น') + 'มากที่สุด',
          fig: sgn(r.d) + mb(Math.abs(r.d)) + ' (' + pct(r.c, r.p) + ')',
          found: 'ยอด ' + mb(r.c) + ' เทียบ ' + mb(r.p) + (tc - tp ? ' · คิดเป็น ' + fmt(r.d / (tc - tp) * 100, 0) + '% ของผลต่างทั้งตัวกรอง (' + sgn(tc - tp) + mb(Math.abs(tc - tp)) + ')' : ''),
          scope: 'มีรายการขาย ' + have + ' จาก ' + days + ' วัน', impact: r.gap ? '⚠ มีวันที่ไม่พบรายการ ผลต่างอาจมาจากเอกสารยังเข้าไม่ครบ' : 'กระทบยอดรวม ' + sgn(r.d) + mb(Math.abs(r.d)),
          action: r.gap ? 'ตรวจว่าเอกสารวันที่ขาดถูกบันทึกแล้วหรือยัง ก่อนสรุปผล' : 'แยกผลต่างเป็นปริมาณ/ราคาในหน้าธุรกิจและสินค้า และสอบถามสถานีถึงปัจจัยหน้างาน', owner: r.gap ? 'ฝ่ายบัญชี / ไอที (ระบบส่งยอดจากสถานี)' : 'ผู้จัดการสถานี / ทีมปฏิบัติการ' });
      });
    }
    var byS = Array.from(groupBy(cur, function (l) { return U[l[2]].station_id; })).sort(function (x, y) { return y[1] - x[1]; });
    if (byS.length > 3 && tc > 0) {
      var t3 = byS.slice(0, 3), s3 = t3.reduce(function (s, x) { return s + x[1]; }, 0);
      var nm = function (sid) { var u = U.find(function (u) { return u.station_id === sid; }); return u ? u.station_name : sid; };
      out.push({ imp: s3 * 0.05, up: null, title: 'ยอดขายกระจุกตัว: 3 อันดับแรกคิดเป็น ' + fmt(s3 / tc * 100, 1) + '%', fig: fmt(s3 / tc * 100, 1) + '%',
        found: t3.map(function (x) { return nm(x[0]) + ' ' + mb(x[1]) + ' (' + fmt(x[1] / tc * 100, 1) + '%)'; }).join(' · '),
        scope: 'จัดอันดับตามยอดขาย ไม่ใช่กำไร', impact: 'ความเสี่ยงจากการพึ่งพาหน่วยหลักไม่กี่แห่ง', action: 'ติดตามหน่วยหลักรายสัปดาห์ และเตรียมแผนรองรับหากยอดของหน่วยใดลดลง', owner: 'ผู้บริหารสายปฏิบัติการ' });
    }
    if (cp) {
      var named = function (l) { return !NONSALES_CONTACT.test(K[l[10]][1]) && K[l[10]][0]; };
      var c1 = groupBy(cur.filter(named), function (l) { return l[10]; }), c0 = groupBy(cmp.filter(named), function (l) { return l[10]; });
      var rs = Array.from(new Set(Array.from(c1.keys()).concat(Array.from(c0.keys())))).map(function (k) { return { k: k, c: c1.get(k) || 0, p: c0.get(k) || 0 }; }).map(function (r) { r.d = r.c - r.p; return r; }).sort(function (x, y) { return x.d - y.d; });
      var w = rs[0];
      if (w && w.d < 0 && w.p > 0) out.push({ imp: Math.abs(w.d), up: false, title: 'ลูกค้าที่ระบุตัวได้ซึ่งยอดลดลงมากที่สุด: ' + K[w.k][1], fig: sgn(w.d) + mb(Math.abs(w.d)) + ' (' + pct(w.c, w.p) + ')',
        found: 'ยอด ' + mb(w.c) + ' เทียบ ' + mb(w.p) + ' · เฉพาะลูกค้าที่มีรหัสคู่ค้าจริง ไม่รวมลูกค้าเงินสด/โปรโมชัน', scope: scope,
        impact: 'ลูกค้าที่ระบุตัวได้ครอบคลุม ' + fmt(tc ? sum(cur.filter(named)) / tc * 100 : 0, 1) + '% ของยอด', action: 'ตรวจสอบคำสั่งซื้อและการออกใบกำกับของลูกค้ารายนี้ (ดูหน้าลูกค้าค้าส่ง)', owner: 'ทีมขายส่ง LPG / ลูกค้าองค์กร' });
    }
    return out.sort(function (x, y) { return y.imp - x.imp; }).slice(0, 5).map(function (x, i) { x.n = i + 1; return x; });
  }

  /* ---------- แถบตัวกรอง (สร้างเป็น DOM ตามสไตล์ดีไซน์) ---------- */
  var subs = [];
  function onChange(fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
  function fire() { save(); subs.slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  var CSS = {
    sec: 'background: var(--card); border: 1px solid var(--line); border-radius: 4px; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px',
    row: 'display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px',
    lab: 'display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--muted)',
    ctl: 'min-height: 44px; padding: 0 12px; border: 1px solid var(--line2); border-radius: 4px; font: inherit; font-size: 14px; color: var(--ink); background: var(--card); box-sizing: border-box; width: 100%',
    chip: 'min-height: 44px; padding: 0 14px; border: 1px solid var(--line2); border-radius: 999px; font-family: \'Outfit\', sans-serif; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background .15s ease, opacity .15s ease',
    note: 'font-size: 13px; color: var(--muted); padding-top: 10px; border-top: 1px solid var(--line)',
    reset: 'min-height: 44px; padding: 0 6px; border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: var(--sandtx); cursor: pointer; text-decoration: underline; text-underline-offset: 3px'
  };
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function selectField(f) {
    var s = h('select', { style: CSS.ctl, 'aria-label': f.label, onchange: function () { f.set(s.value); fire(); } });
    f.options().forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(o[0]) === String(f.get())) op.selected = true; s.appendChild(op); });
    return h('label', { style: CSS.lab + '; flex: ' + (f.flex || '1 1 160px') }, [document.createTextNode(f.label), s]);
  }
  function dateField(f) {
    var i = h('input', { type: 'date', style: CSS.ctl + "; font-family: 'Outfit', sans-serif", min: iso(0), max: iso(MAXDAY), value: iso(f.get()),
      onchange: function () { if (!i.value) return; f.set(Math.max(0, Math.min(MAXDAY, dayOf(i.value)))); fire(); } });
    return h('label', { style: CSS.lab + '; flex: 0 1 165px' }, [document.createTextNode(f.label), i]);
  }
  function chipsField(f) {
    var box = h('div', { style: 'display: flex; gap: 6px; flex-wrap: wrap' });
    f.options().forEach(function (o) {
      var on = f.isOn(o[0]);
      box.appendChild(h('button', { type: 'button', 'aria-pressed': String(on), style: CSS.chip + '; background: ' + (on ? 'var(--tint)' : 'var(--card)') + '; color: var(--ink); opacity: ' + (on ? '1' : '.55'),
        onclick: function () { f.toggle(o[0]); fire(); } }, [o[2] ? h('span', { style: 'width: 10px; height: 10px; border-radius: 50%; background: ' + o[2] }) : null, document.createTextNode(o[1])]));
    });
    return h('div', { role: 'group', 'aria-label': f.label, style: CSS.lab }, [document.createTextNode(f.label), box]);
  }
  function textField(f) {
    var i = h('input', { type: 'search', placeholder: f.placeholder || '', style: CSS.ctl, value: f.get() || '', oninput: function () { f.set(i.value); clearTimeout(i.__t); i.__t = setTimeout(fire, 250); } });
    return h('label', { style: CSS.lab + '; flex: ' + (f.flex || '1 1 200px') }, [document.createTextNode(f.label), i]);
  }
  function mountFilters(el, spec) {
    var render = function () {
      el.innerHTML = '';
      var sec = h('section', { 'aria-label': 'ตัวกรอง', style: CSS.sec });
      (spec.rows || [spec.fields]).forEach(function (row) {
        var r = h('div', { style: CSS.row });
        row.forEach(function (f) { r.appendChild(f.type === 'date' ? dateField(f) : f.type === 'chips' ? chipsField(f) : f.type === 'text' ? textField(f) : selectField(f)); });
        sec.appendChild(r);
      });
      var last = sec.lastChild;
      last.appendChild(h('button', { type: 'button', style: CSS.reset, onclick: function () { spec.reset(); fire(); }, text: 'ล้างตัวกรอง' }));
      if (spec.note) sec.appendChild(h('div', { style: CSS.note, text: spec.note() }));
      el.appendChild(sec);
    };
    render();
    return onChange(render);
  }

  /* ตัวกรองมาตรฐานของหน้าที่ใช้ข้อมูลยอดขาย */
  var F = {
    period: function () {
      var md = dayDate(MAXDAY), opts = [['lastmonth', 'เดือนล่าสุดที่ครบเดือน'], ['mtd', 'เดือนนี้ถึงวันข้อมูลล่าสุด (MTD)'], ['ytd', 'ตั้งแต่ต้นปี (YTD)']];
      for (var m = md.getUTCMonth(); m >= 0; m--) opts.push(['m' + m, TH_MF[m] + ' ' + (md.getUTCFullYear() + 543) + (m === md.getUTCMonth() ? ' (ยังไม่จบเดือน)' : '')]);
      opts.push(['custom', 'กำหนดเอง']);
      return { label: 'ช่วงเวลา', flex: '1 1 210px', options: function () { return opts; }, get: function () { return S.preset; }, set: function (v) { S.preset = v; } };
    },
    from: function () { return { type: 'date', label: 'ตั้งแต่', get: function () { applyPreset(); return S.from; }, set: function (v) { S.preset = 'custom'; S.from = v; if (S.to < v) S.to = v; } }; },
    to: function () { return { type: 'date', label: 'ถึง', get: function () { applyPreset(); return S.to; }, set: function (v) { S.preset = 'custom'; S.to = v; if (S.from > v) S.from = v; } }; },
    cos: function () { return { type: 'chips', label: 'บริษัท', options: function () { return CO.map(function (c) { return [c, c, CO_COLOR[c]]; }); }, isOn: function (c) { return S.cos.indexOf(c) >= 0; },
      toggle: function (c) { var i = S.cos.indexOf(c); if (i >= 0) { if (S.cos.length > 1) S.cos.splice(i, 1); } else S.cos.push(c); } }; },
    channel: function () { return { label: 'ช่องทาง', options: function () { return [['', 'ค้าปลีก + ค้าส่ง'], ['ค้าปลีก', 'ค้าปลีก'], ['ค้าส่ง', 'ค้าส่ง']]; }, get: function () { return S.channel; }, set: function (v) { S.channel = v; } }; },
    /* สถานี/แผนก: สถานีที่มีหลายแผนกในบัญชี (เช่น พระราม 5 = น้ำมัน PTT + Café Amazon + 7-Eleven) เลือกทั้งสถานีหรือรายแผนกได้ */
    station: function () { return { label: 'สถานี / แผนก', flex: '1 1 260px', options: function () {
      var o = [['', 'ทุกสถานี/แผนก']], by = new Map();
      U.forEach(function (u, i) { if (S.cos.indexOf(u.company) < 0 || unitLast[i] < 0) return; if (!by.has(u.station_id)) by.set(u.station_id, []); by.get(u.station_id).push(i); });
      by.forEach(function (ids, sid) {
        var u0 = U[ids[0]]; o.push([sid, u0.company + ' · ' + u0.station_name + (ids.length > 1 ? ' (ทุกแผนก)' : '')]);
        if (ids.length > 1) ids.forEach(function (i) { var u = U[i]; o.push(['u:' + i, '\u00a0\u00a0\u00a0└ ' + u.station_name + ' · ' + (u.unit_name || 'ไม่ระบุ') + (u.dept_code ? ' (แผนก ' + u.dept_code + ')' : '')]); });
      });
      if (S.station && !o.some(function (x) { return x[0] === S.station; })) S.station = '';
      return o; }, get: function () { return S.station; }, set: function (v) { S.station = v; } }; },
    /* หน่วยธุรกิจตามแผนกในบัญชี — รวมทุกสถานี เช่น Café Amazon (พระราม 5 + พิบูลสงคราม), 7-Eleven */
    biz: function () { return { label: 'หน่วยธุรกิจ (แผนก)', options: function () {
      var amt = new Map(); L.forEach(function (l) { var u = U[l[2]]; if (P[l[3]].include && S.cos.indexOf(CO[l[1]]) >= 0 && u.unit_name && u.unit_name !== 'ไม่ระบุสถานี') amt.set(u.unit_name, (amt.get(u.unit_name) || 0) + l[7]); });
      if (S.biz && !amt.has(S.biz)) S.biz = '';
      return [['', 'ทุกหน่วยธุรกิจ']].concat(Array.from(amt).sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { return [x[0], x[0]]; })); },
      get: function () { return S.biz; }, set: function (v) { S.biz = v; } }; },
    group: function () { return { label: 'กลุ่มธุรกิจ', options: function () { return [['', 'ทุกกลุ่ม']].concat(GROUPS.map(function (g) { return [g, g]; })); }, get: function () { return S.group; }, set: function (v) { S.group = v; S.product = ''; } }; },
    product: function () { return { label: 'สินค้า', options: function () {
      var amt = new Map(); L.forEach(function (l) { var p = P[l[3]]; if (p.include && S.cos.indexOf(p.co) >= 0 && (!S.group || p.group === S.group)) amt.set(l[3], (amt.get(l[3]) || 0) + l[7]); });
      return [['', 'ทุกสินค้า']].concat(Array.from(amt).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { var p = P[x[0]]; return [p.co + '|' + p.id, p.co + ' · ' + p.name]; })); },
      get: function () { return S.product; }, set: function (v) { S.product = v; } }; },
    resetSales: function () { var d = defaults(); ['preset', 'cos', 'channel', 'station', 'biz', 'group', 'product'].forEach(function (k) { S[k] = d[k]; }); },
    note: function () { var c = ctx(); return 'ช่วงที่เลือก ' + rangeLabelLong(c.a, c.b) + ' · เทียบกับ ' + (c.cp ? rangeLabelLong(c.cp[0], c.cp[1]) + (dayDate(c.a).getUTCDate() === 1 ? ' (ช่วงเดียวกันของเดือนก่อนหน้า)' : ' (ช่วงยาวเท่ากันก่อนหน้า)') : 'ไม่มี — ข้อมูลเริ่ม 1 ม.ค. 2569') + (c.partial ? ' · ⚠ ช่วงนี้ยังไม่จบเดือน' : ''); }
  };

  /* ---------- CSV ---------- */
  function csv(name, head, rows) {
    var e = function (v) { var s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var t = '﻿' + [head].concat(rows).map(function (r) { return r.map(e).join(','); }).join('\r\n');
    return window.claude.use('downloads').then(function (d) { return d.save({ filename: name, data: t }); });
  }

  function init(ds) {
    X = ds; M = ds.model; U = M.units; P = M.products; K = M.contacts; L = M.lines;
    CO = M.meta.companies.map(function (c) { return c.code; });
    EPOCH = new Date(M.meta.epoch + 'T00:00:00Z');
    MAXDAY = L.reduce(function (m, l) { return Math.max(m, l[0]); }, 0);
    buildUnitDays();
    S = load() || defaults();
    applyPreset();
  }

  return {
    init: init, get data() { return X; }, get S() { return S; }, get M() { return M; }, get U() { return U; }, get P() { return P; }, get K() { return K; }, get L() { return L; }, get CO() { return CO; }, get MAXDAY() { return MAXDAY; },
    TH_M: TH_M, GROUPS: GROUPS, CH: CH, CO_TH: CO_TH, CO_COLOR: CO_COLOR, NONSALES_CONTACT: NONSALES_CONTACT,
    dayDate: dayDate, iso: iso, dayOf: dayOf, thDate: thDate, thMonth: thMonth, rangeLabel: rangeLabel, rangeLabelLong: rangeLabelLong, monthRange: monthRange,
    fmt: fmt, mb: mb, M2: M2, sgn: sgn, pct: pct, diffTxt: diffTxt, esc: esc,
    applyPreset: applyPreset, comparePeriod: comparePeriod, lineOK: lineOK, sel: sel, sum: sum, groupBy: groupBy, grp: grp, co: co, unitLabel: unitLabel,
    ctx: ctx, monthly: monthly, priceVolume: priceVolume, unitGaps: unitGaps, unitDaysIn: unitDaysIn, insights: insights,
    get unitLast() { return unitLast; },
    F: F, mountFilters: mountFilters, onChange: onChange, fire: fire, save: save, defaults: defaults, csv: csv, h: h
  };
})();
