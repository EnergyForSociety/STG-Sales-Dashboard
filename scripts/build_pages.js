// รวมหน้าดีไซน์จาก Claude Design (design/project/*.dc.html) เป็น data/pages.json เพื่อนำไปเข้ารหัสใน build-static.js
// ใช้: node scripts/build_pages.js [--src design/project] [--out data]
// ไฟล์ใน design/ และ data/ มีตัวเลขจริง — อยู่ใน .gitignore ห้าม commit
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const src = path.resolve(arg('src', path.join(ROOT, 'design', 'project_live')));
const out = path.resolve(arg('out', path.join(ROOT, 'data')));

const canvas = JSON.parse(fs.readFileSync(path.join(src, 'canvas.json'), 'utf8'));
const order = canvas.order && canvas.order.length ? canvas.order : Object.keys(canvas.boards);
const pages = {}, titles = {};
const problems = [];
for (const f of order) {
  let h = fs.readFileSync(path.join(src, f), 'utf8');
  const n0 = h.length;
  h = h.replace(/<script src="\.\/support\.js"><\/script>\s*/g, '');
  h = h.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '');
  h = h.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">\s*/g, '');
  // โลโก้ AE (asset ของ Claude Design) → ไฟล์ในเว็บ
  h = h.replace(/\/_blob\/f5bf6d88b725a49ec9072f25c78f1ffd/g, 'assets/ae-logo.png');
  // ชื่อผู้ใช้และปุ่มออกจากระบบในส่วนหัว → ผูกกับบัญชี Microsoft 365 ที่ login จริง (app.js: wireChrome)
  const LOGOUT = '<button type="button" data-dc-logout style="min-height: 44px; padding: 0 16px; border: 1px solid #C49A76; background: transparent; border-radius: 4px; font: inherit; font-size: 14px; color: #FFFFFF; cursor: pointer">ออกจากระบบ</button>';
  h = h.replace(/<span style="font-size: 14px; color: #E9DCCF">[^<]*<\/span>(\s*<button type="button" style="[^"]*">ออกจากระบบ<\/button>)?/,
    () => '<span data-dc-who style="font-size: 14px; color: #E9DCCF"></span>\n' + LOGOUT);
  if (!/data-dc-logout/.test(h)) problems.push(f + ': ไม่พบปุ่มออกจากระบบในส่วนหัว');
  if (/\/_blob\//.test(h)) problems.push(f + ': ยังมี /_blob/ ที่ไม่ได้แปลง');
  if (/fonts\.googleapis/.test(h)) problems.push(f + ': ยังโหลดฟอนต์จาก Google');
  pages[f] = h;
  titles[f] = (canvas.boards[f] && canvas.boards[f].title) || f;
  console.log(f.padEnd(20), (n0 / 1024).toFixed(0) + ' KB');
}
if (problems.length) { console.error('พบปัญหา:\n- ' + problems.join('\n- ')); process.exit(1); }
const asof = (fs.readFileSync(path.join(src, order[0]), 'utf8').match(/ดึงข้อมูล <span[^>]*>(\d\d)\/(\d\d)\/(\d{4})/) || []).slice(1);
const asofIso = asof.length ? `${asof[2]}-${asof[1]}-${asof[0]}` : new Date().toISOString().slice(0, 10);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'pages.json'), JSON.stringify({ order, titles, pages }));
// ข้อมูลประกอบที่หน้าเว็บใช้คำนวณตามตัวกรอง: model.json (scripts/build_model.py) + ไฟล์จาก design/data
// wc.json มาจาก scripts/build_wc.py (ลูกหนี้/เจ้าหนี้รายเอกสาร) · ที่เหลือมาจาก design/data
const extra = { station_pl: 'station_pl.json', wc: null, ops: 'ops_model.json', yoy: 'yoy.json' };
for (const [k, f] of Object.entries(extra)) if (f) fs.copyFileSync(path.join(ROOT, 'design', 'data', f), path.join(out, k + '.json'));
if (!fs.existsSync(path.join(out, 'wc.json'))) { console.error('ไม่พบ data/wc.json — รัน python3 scripts/build_wc.py ก่อน'); process.exit(1); }
if (!fs.existsSync(path.join(out, 'model.json'))) { console.error('ไม่พบ data/model.json — รัน python3 scripts/build_model.py ก่อน'); process.exit(1); }
const model = JSON.parse(fs.readFileSync(path.join(out, 'model.json'), 'utf8'));
const maxDay = model.lines.reduce((m, l) => Math.max(m, l[0]), 0);
const asofModel = new Date(Date.parse(model.meta.epoch + 'T00:00:00Z') + maxDay * 864e5).toISOString().slice(0, 10);
fs.writeFileSync(path.join(out, '_snapshot.json'), JSON.stringify({ asof: asofModel, fetched_at: model.meta.generated_at, source: 'TRCloud (read-only) + Claude Design', datasets: ['pages', 'model', ...Object.keys(extra)] }, null, 2));
console.log('เขียน data/pages.json (' + order.length + ' หน้า) + ข้อมูลประกอบ · ข้อมูล ณ', asofModel);
