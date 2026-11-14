// เซิร์ฟเวอร์สำหรับพัฒนาในเครื่อง: node scripts/serve.js [port] แล้วเปิด http://localhost:8080/public/
// (โหมดนี้อ่าน data/pages.json ที่ไม่เข้ารหัส — ใช้ในเครื่องเท่านั้น ห้ามเปิดให้คนอื่นเข้าถึง)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), port = +((require.main === module && process.argv[2]) || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html');
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !/^\/(public|data\/(pages|model|station_pl|wc|ops|yoy)\.json)/.test(rel)) { r.writeHead(404); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
});
srv.listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}/public/`));
module.exports = srv;
