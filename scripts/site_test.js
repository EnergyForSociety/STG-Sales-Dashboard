// ทดสอบเว็บ static ที่เข้ารหัสแล้ว: หน้า login, ไม่มีข้อมูลจริงในไฟล์ที่ขึ้น Git, ถอดรหัสแล้วทุกหน้าแสดงผล,
// เมนู 7 หมวดตามกรอบผู้บริหาร, ตัวกรองใช้ร่วมกันทุกหน้า, ธีมสามโหมด, กฎหน่วย/VAT และ key ข้ามบริษัทไม่ชน
// ใช้: node scripts/site_test.js <site_dir> <test_key_file> [screenshot_dir]
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [site, keyFile, shots] = process.argv.slice(2);
if (!site || !keyFile) { console.error('ใช้: node scripts/site_test.js <site_dir> <test_key_file> [screenshot_dir]'); process.exit(2); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(site, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });

let pass = 0; const fails = [];
const ok = (cond, name, detail) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); } };
const PAGES = ['Main', 'Products', 'Stations', 'Wholesale', 'Profit', 'Cash', 'Project', 'Strategy', 'Ops', 'Issues'];
const GROUPS = ['Executive', 'การขาย', 'การเงิน', 'โครงการ', 'กลยุทธ์', 'ผลงานเทียบเป้า', 'สถานะข้อมูล'];

srv.listen(8099, async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  // 1) ไฟล์ที่ขึ้นเว็บต้องไม่มีข้อมูลจริงแบบอ่านได้ และไม่มีความลับ
  const files = fs.readdirSync(site).filter(f => /\.(js|html|css)$/.test(f));
  const leaks = [];
  for (const f of files) {
    const t = fs.readFileSync(path.join(site, f), 'utf8');
    if (f === 'data.enc.js') { if (/ลิ้มบางปะหัน|AR00C|สตาร์ ?แก๊ส/.test(t)) leaks.push(f + ': พบข้อความไทยที่อ่านได้ในไฟล์เข้ารหัส'); continue; }
    if (/ลิ้มบางปะหัน|AR00C-|IV26\d{8}|78\.83 ล้าน/.test(t)) leaks.push(f + ': พบข้อมูลจริง');
    if (/(client_secret|BEGIN [A-Z ]*PRIVATE KEY|passkey\s*[:=]\s*['"][^'"]{8,})/i.test(t)) leaks.push(f + ': พบความลับ');
  }
  ok(leaks.length === 0, 'ไฟล์ที่ขึ้น GitHub Pages ไม่มีข้อมูลจริงหรือความลับแบบอ่านได้', leaks.join(' · '));

  // 2) หน้า login
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1200);
  const lock = await p.evaluate(() => ({ lock: !document.getElementById('lock').hidden, dash: document.getElementById('dash-root').hidden, robots: !!document.querySelector('meta[name=robots]') }));
  ok(lock.lock && lock.dash, 'ยังไม่ login: แสดงหน้าเข้าสู่ระบบ ไม่แสดง Dashboard');
  ok(lock.robots, 'มี meta robots กันการเก็บดัชนี');
  if (shots) await p.screenshot({ path: path.join(shots, 'site_login.png') });

  // 3) กุญแจผิดต้องถอดรหัสไม่ได้
  const bad = await p.evaluate(async () => { try { const k = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, ['decrypt']);
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Uint8Array.from(atob(DASH_ENC.i), c => c.charCodeAt(0)) }, k, Uint8Array.from(atob(DASH_ENC.c), c => c.charCodeAt(0))); return 'decrypted'; } catch (e) { return e.name; } });
  ok(bad === 'OperationError', 'กุญแจผิดถอดรหัสไม่ได้ (AES-GCM ตรวจความถูกต้อง)', bad);

  // 4) ถอดรหัสด้วยกุญแจทดสอบแล้วแสดงผล
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  const info = await p.evaluate(async (k) => { const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', b64(k), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(DASH_ENC.i) }, key, b64(DASH_ENC.c));
    const bundle = JSON.parse(new TextDecoder().decode(plain));
    document.getElementById('lock').hidden = true; document.getElementById('dash-root').hidden = false; DASHApp.start(bundle);
    await new Promise(r => setTimeout(r, 2000));
    const M = bundle.ds.model, U = M.units;
    const ids = new Set(M.lines.map(l => M.meta.companies[l[1]].code + '|' + l[12]));
    return { pages: Object.keys(bundle.ds.pages.pages), datasets: Object.keys(bundle.ds),
      lineKeyUnique: ids.size === M.lines.length, lines: M.lines.length,
      stations: new Set(U.map(u => u.company + '|' + u.station_id)).size, units: U.length,
      prodKeyHasCo: M.products.every(x => !!x.co), lpgFactor: (bundle.ds.lpg && bundle.ds.lpg.rows[0] || {}).factor }; }, key);
  ok(info.pages.length === 10, 'bundle มีครบ 10 หน้า', info.pages.length + ' หน้า');
  ok(info.lineKeyUnique, 'key ข้ามบริษัทไม่ชน: บริษัท+item_id ไม่ซ้ำทั้ง ' + info.lines + ' บรรทัด');
  ok(info.stations < info.units, 'สถานีหลายธุรกิจไม่ถูกนับเป็นสถานีใหม่', info.stations + ' สถานี · ' + info.units + ' หน่วยธุรกิจ');
  ok(info.prodKeyHasCo, 'รหัสสินค้ามี company code ร่วมใน key เสมอ');
  ok(info.lpgFactor > 0, 'มีค่าแปลงหน่วย LPG พร้อมวันที่มีผล (config/lpg_factor.csv)', String(info.lpgFactor));

  // 5) ทุกหน้าแสดงผลได้ ไม่มี NaN/undefined และเมนู 7 หมวดครบ
  for (const f of PAGES) {
    await p.evaluate(h => { location.hash = '#/' + h; }, f); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const t = document.getElementById('dc-root').innerText;
      return { len: t.length, bad: /NaN|undefined|Infinity/.test(t), groups: [...document.querySelectorAll('#dc-root nav > div:first-child a')].map(a => a.textContent.trim()) }; });
    ok(r.len > 900 && !r.bad, 'หน้า ' + f + ' แสดงผลได้ ไม่มี NaN/undefined', r.len + ' ตัวอักษร' + (r.bad ? ' · พบ NaN' : ''));
    if (f === 'Main') ok(GROUPS.every((g, i) => r.groups[i] === g), 'เมนูหลัก 7 หมวดตามกรอบผู้บริหาร', r.groups.join(' / '));
  }

  // 6) หน้าที่ยังไม่มีข้อมูลต้องบอกตรง ๆ ไม่แสดงศูนย์
  await p.evaluate(() => { location.hash = '#/Project'; }); await p.waitForTimeout(700);
  const proj = await p.evaluate(() => document.getElementById('dc-root').innerText);
  ok(/ยังไม่มีแหล่งข้อมูลโครงการ/.test(proj) && /ไม่คำนวณ Resource Utilization/.test(proj), 'หน้าโครงการแจ้งว่ายังไม่มีแหล่งข้อมูล และไม่คำนวณ Resource Utilization แทน');
  await p.evaluate(() => { location.hash = '#/Strategy'; }); await p.waitForTimeout(700);
  const strat = await p.evaluate(() => document.getElementById('dc-root').innerText);
  ok(/Customer Lifetime Value \(CLV\)[\s\S]{0,40}ไม่คำนวณ/.test(strat), 'หน้ากลยุทธ์ระบุว่าไม่คำนวณ CLV พร้อมเหตุผล');
  ok(/เทียบเท่าลิตร/.test(strat), 'หน้ากลยุทธ์แสดงปริมาณ LPG เทียบเท่าลิตรพร้อม factor ที่ใช้');

  // 7) ตัวกรองใช้ร่วมกันทุกหน้า
  await p.evaluate(() => { location.hash = '#/Products'; }); await p.waitForTimeout(800);
  const filt = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll('#dc-root button')].find(b => b.textContent.trim() === 'TWP');
    if (!btn) return { err: 'ไม่พบปุ่มบริษัท TWP' };
    btn.click(); await new Promise(r => setTimeout(r, 600));
    const before = JSON.parse(sessionStorage.getItem('star-filters-v1')).cos;
    location.hash = '#/Stations'; await new Promise(r => setTimeout(r, 900));
    const after = JSON.parse(sessionStorage.getItem('star-filters-v1')).cos;
    const chip = [...document.querySelectorAll('#dc-root button')].find(b => b.textContent.trim() === 'TWP');
    return { before, after, pressed: chip && chip.getAttribute('aria-pressed') };
  });
  ok(!filt.err && JSON.stringify(filt.before) === JSON.stringify(filt.after) && filt.pressed === String(filt.after.includes('TWP')),
    'ตัวกรองบริษัทใช้ร่วมกันข้ามหน้า', filt.err || JSON.stringify(filt));

  // 8) ธีมสามโหมด
  for (const t of ['auto', 'light', 'dark']) {
    const r = await p.evaluate(async (th) => { const names = { auto: 'อัตโนมัติ', light: 'สว่าง', dark: 'มืด' };
      const btn = [...document.querySelectorAll('#dc-root button')].find(b => b.textContent.trim() === names[th]);
      if (!btn) return { err: 'ไม่พบปุ่มธีม ' + names[th] }; btn.click(); await new Promise(r => setTimeout(r, 400));
      return { pref: localStorage.getItem('star-theme'), cls: document.querySelector('#dc-root > div').className }; }, t);
    ok(!r.err && r.pref === t && /th-(light|dark)/.test(r.cls), 'ธีม ' + t + ' ใช้งานได้และจำค่าที่เลือก', r.err || JSON.stringify(r));
  }

  if (shots) { await p.evaluate(() => { location.hash = '#/Main'; }); await p.waitForTimeout(900); await p.screenshot({ path: path.join(shots, 'site_dashboard.png') }); }
  ok(errs.length === 0, 'ไม่มี JavaScript error', errs.slice(0, 3).join(' · '));

  console.log('\nผ่าน ' + pass + ' ข้อ' + (fails.length ? ' · ไม่ผ่าน ' + fails.length + ' ข้อ:\n- ' + fails.join('\n- ') : ''));
  await b.close(); srv.close(); process.exit(fails.length ? 1 : 0);
});
