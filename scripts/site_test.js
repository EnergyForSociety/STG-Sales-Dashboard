// ทดสอบเว็บ static ที่เข้ารหัสแล้ว: หน้า login ขึ้น, ไม่มีข้อมูลดิบในไฟล์, ถอดรหัสด้วยกุญแจทดสอบแล้ว Dashboard แสดงผล
// ใช้: node scripts/site_test.js <site_dir> <test_key_file> [screenshot_dir]
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [site, keyFile, shots] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(site, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });
srv.listen(8099, async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8099/'); await p.waitForTimeout(1500);
  const lock = await p.evaluate(() => ({ lock: !document.getElementById('lock').hidden, dash: document.getElementById('dash-root').hidden, err: document.getElementById('err').textContent, robots: !!document.querySelector('meta[name=robots]') }));
  console.log('login screen:', JSON.stringify(lock));
  if (shots) await p.screenshot({ path: path.join(shots, 'site_login.png') });
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  const ok = await p.evaluate(async (k) => { const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', b64(k), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(DASH_ENC.i) }, key, b64(DASH_ENC.c));
    const bundle = JSON.parse(new TextDecoder().decode(plain));
    document.getElementById('lock').hidden = true; document.getElementById('dash-root').hidden = false; DASHApp.start(bundle);
    await new Promise(r => setTimeout(r, 2000));
    return { pages: Object.keys(bundle.ds.pages.pages).length, title: document.title, has7883: document.getElementById('dc-root').innerText.includes('78.83') }; }, key);
  console.log('decrypted + rendered:', JSON.stringify(ok));
  // wrong key must fail (GCM authentication)
  const bad = await p.evaluate(async () => { try { const k = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', false, ['decrypt']);
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Uint8Array.from(atob(DASH_ENC.i), c => c.charCodeAt(0)) }, k, Uint8Array.from(atob(DASH_ENC.c), c => c.charCodeAt(0))); return 'decrypted?!'; } catch (e) { return e.name; } });
  console.log('wrong key ->', bad);
  if (shots) { await p.waitForTimeout(500); await p.screenshot({ path: path.join(shots, 'site_dashboard.png') }); }
  console.log('page errors:', JSON.stringify(errs)); await b.close(); srv.close();
});
