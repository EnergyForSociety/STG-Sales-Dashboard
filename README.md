# STAR · Sales Executive Dashboard
ธุรกิจสถานีบริการ STG · STP · TWP — เว็บ static บน GitHub Pages · ข้อมูลเข้ารหัส AES-256-GCM · เปิดได้เฉพาะผู้ที่ login Microsoft 365 และอยู่ในกลุ่ม `stg_dashboard_viewers`

- URL: https://energyforsociety.github.io/STG-Sales-Dashboard/
- ความปลอดภัยและการ deploy: `docs/SECURITY-DEPLOY.md`
- หน้าเว็บ 8 หน้าออกแบบใน Claude Design (Executive Snapshot, กำไรรายสถานี, เงินทุนหมุนเวียน, ธุรกิจและสินค้า, บริษัทและสถานี, ลูกค้าค้าส่ง, Operation, ประเด็นติดตาม)

## โครงสร้าง
| โฟลเดอร์ | ขึ้น Git | หน้าที่ |
|---|---|---|
| `public/` | ✅ | `app.js` = ตัวแสดงผลหน้าดีไซน์ (.dc.html) + เปลี่ยนหน้า + ส่งออก CSV · `gate.js` · ฟอนต์ IBM Plex Sans Thai / Outfit · โลโก้ |
| `static/` | ✅ | `auth-config.js` (client/tenant/group/keyShareUrl — ไม่มีความลับ), `gate.css` |
| `scripts/` | ✅ | `build_model.py`, `build_wc.py`, `build_pages.js` (design/project_live → data/pages.json), `build-static.js` (เข้ารหัส → site/), `site_test.js`, `serve.js` |
| `site/` | ✅ | ผลลัพธ์ที่ขึ้น GitHub Pages — มีแต่ข้อมูล**เข้ารหัส** |
| `design/` | ❌ | ไฟล์จาก Claude Design (หน้า .dc.html + สคริปต์สร้างตัวเลข) มีตัวเลขจริงไม่เข้ารหัส (`.gitignore`) |
| `raw/`, `data/` | ❌ | ข้อมูลดิบ TRCloud และข้อมูลที่ยังไม่เข้ารหัส (`.gitignore`) |
| กุญแจ | ❌ | เก็บนอก repo เท่านั้น — ห้าม commit / ส่งแชท / ใส่ zip |

## รอบอัปเดตข้อมูล (รายเดือน)
1. ดึง IV3 + CN3 (และ AR/AP) ของ 3 บริษัทจาก TRCloud ด้วย user อ่านอย่างเดียว · รับไฟล์ Excel ของ Operation (เป้า/AM, ฐานปีก่อน) และ P&L รายสถานี
2. รันสคริปต์ใน `design/scripts/` ตาม `design/HANDOFF.md` (Rebuild pipeline) → อัปเดต `design/project/*.dc.html`
3. ดึง IV3/CN3 และลูกหนี้/เจ้าหนี้ (get_receivable_due / get_payable_due) ด้วย user อ่านอย่างเดียว เก็บใน `raw/` แล้วรัน `python3 scripts/build_model.py` (→ `data/model.json`) และ `python3 scripts/build_wc.py` (→ `data/wc.json`)
   จากนั้น `python3 design/patch_pages.py` (ใส่ตัวกรองและช่องข้อมูลลงหน้าดีไซน์ → `design/project_live`) และ `node scripts/build_pages.js` → `data/pages.json`
4. `node scripts/build-static.js --key <path กุญแจนอก repo> --out site`
5. ตรวจใน GitHub Desktop ว่าเปลี่ยนเฉพาะ `site/` (และโค้ดที่แก้) และ**ไม่มี** `design/`, `data/`, `raw/` → Commit → Push → GitHub Actions เผยแพร่เอง · ผู้ใช้กด Ctrl+F5

พัฒนา/ทดสอบในเครื่อง: `node scripts/build_pages.js` แล้ว `node scripts/serve.js` เปิด http://localhost:8080/public/ (อ่าน data/pages.json ไม่เข้ารหัส — ใช้ในเครื่องเท่านั้น)

## ข้อมูลเป็น snapshot
ไม่ใช่ข้อมูลสด · แต่ละหน้าแสดงเวลาที่ดึงข้อมูลและแหล่งข้อมูล (TRCloud / Excel)
