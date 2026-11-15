# STAR · Sales Executive Dashboard
ธุรกิจสถานีบริการ STG · STP · TWP — เว็บ static บน GitHub Pages · ข้อมูลเข้ารหัส AES-256-GCM · เปิดได้เฉพาะผู้ที่ login Microsoft 365 และอยู่ในกลุ่ม `stg_dashboard_viewers`

- URL: https://energyforsociety.github.io/STG-Sales-Dashboard/
- ความปลอดภัยและการ deploy: `docs/SECURITY-DEPLOY.md`

## เมนู 7 หมวดตามกรอบผู้บริหาร (เมนูสองชั้น)

| หมวด | หน้าย่อย | ไฟล์ |
|---|---|---|
| Executive | Executive Snapshot | `Main.dc.html` |
| การขาย | ธุรกิจและสินค้า · บริษัทและสถานี · ลูกค้าค้าส่ง | `Products` · `Stations` · `Wholesale` |
| การเงิน | กำไรรายสถานี · เงินทุนหมุนเวียน | `Profit` · `Cash` |
| โครงการ | โครงการและการส่งมอบ (ยังไม่มีแหล่งข้อมูล) | `Project` |
| กลยุทธ์ | ภาพรวมการเติบโต | `Strategy` |
| ผลงานเทียบเป้า | Operation | `Ops` |
| สถานะข้อมูล | ประเด็นติดตามและข้อมูลต้นทาง | `Issues` |

โครงเมนูกำหนดที่เดียวใน `GROUPS` ของ `design/patch_pages.py` · หน้าเดิม 8 หน้าอยู่ครบ ไม่มีรายงานใดถูกตัดทิ้ง
รายละเอียดการ map เมนูเดิมและสิ่งที่เปลี่ยน: `docs/CEO-FRAMEWORK.md` · ความพร้อม KPI: `docs/KPI-READINESS.md` · กฎหน่วย LPG/VAT: `docs/LPG-VAT-RULES.md` · ข้อมูลที่ต้องขอเพิ่ม: `docs/DATA-REQUESTS.md`

## โครงสร้าง
| โฟลเดอร์ | ขึ้น Git | หน้าที่ |
|---|---|---|
| `public/` | ✅ | `app.js` = ตัวแสดงผลหน้าดีไซน์ (.dc.html) + เปลี่ยนหน้า + ส่งออก CSV · `gate.js` · ฟอนต์ IBM Plex Sans Thai / Outfit · โลโก้ |
| `static/` | ✅ | `auth-config.js` (client/tenant/group/keyShareUrl — ไม่มีความลับ), `gate.css` |
| `config/` | ✅ | `stations.csv`, `product_rules.csv`, `channel_rules.csv`, `lpg_factor.csv` (ค่าแปลงหน่วย LPG พร้อมวันที่มีผล) |
| `scripts/` | ✅ | `build_model.py`, `build_wc.py`, `build_stock.py`, `build_lpg.py`, `build_pages.js` (design/project_live → data/pages.json), `build-static.js` (เข้ารหัส → site/), `site_test.js`, `validate.py`, `serve.js` |
| `site/` | ✅ | ผลลัพธ์ที่ขึ้น GitHub Pages — มีแต่ข้อมูล**เข้ารหัส** |
| `design/` | ❌ | ไฟล์จาก Claude Design (หน้า .dc.html + สคริปต์สร้างตัวเลข) มีตัวเลขจริงไม่เข้ารหัส (`.gitignore`) |
| `raw/`, `data/` | ❌ | ข้อมูลดิบ TRCloud และข้อมูลที่ยังไม่เข้ารหัส (`.gitignore`) |
| กุญแจ | ❌ | เก็บนอก repo เท่านั้น — ห้าม commit / ส่งแชท / ใส่ zip |

## รอบอัปเดตข้อมูล (รายเดือน)
1. ดึง IV3 + CN3 (และ AR/AP) ของ 3 บริษัทจาก TRCloud ด้วย user อ่านอย่างเดียว · รับไฟล์ Excel ของ Operation (เป้า/AM, ฐานปีก่อน) และ P&L รายสถานี
2. รันสคริปต์ใน `design/scripts/` ตาม `design/HANDOFF.md` (Rebuild pipeline) → อัปเดต `design/project/*.dc.html`
3. ดึง IV3/CN3 และลูกหนี้/เจ้าหนี้ (get_receivable_due / get_payable_due) ด้วย user อ่านอย่างเดียว เก็บใน `raw/` แล้วรัน `python3 scripts/build_model.py` (→ `data/model.json`) และ `python3 scripts/build_wc.py` (→ `data/wc.json`) และ `python3 scripts/build_stock.py` (ใบปรับปรุงสต๊อกจากการตรวจนับ LPG/น้ำมัน จาก search_gr keyword=ปรับปรุง → `data/stock.json`)
   และ `python3 scripts/build_lpg.py` (ค่าแปลงหน่วย LPG จาก `config/lpg_factor.csv` → `data/lpg.json`)
   จากนั้น `python3 design/patch_pages.py` (ใส่ตัวกรอง ช่องข้อมูล เมนู 7 หมวด และสร้างหน้าโครงการ/กลยุทธ์ → `design/project_live`) และ `node scripts/build_pages.js` → `data/pages.json`
4. `node scripts/build-static.js --key <path กุญแจนอก repo> --out site`
5. ตรวจใน GitHub Desktop ว่าเปลี่ยนเฉพาะ `site/` (และโค้ดที่แก้) และ**ไม่มี** `design/`, `data/`, `raw/` → Commit → Push → GitHub Actions เผยแพร่เอง · ผู้ใช้กด Ctrl+F5

พัฒนา/ทดสอบในเครื่อง: `node scripts/build_pages.js` แล้ว `node scripts/serve.js` เปิด http://localhost:8080/public/ (อ่าน data/pages.json ไม่เข้ารหัส — ใช้ในเครื่องเท่านั้น)

## ข้อมูลเป็น snapshot
ไม่ใช่ข้อมูลสด · แต่ละหน้าแสดงเวลาที่ดึงข้อมูลและแหล่งข้อมูล (TRCloud / Excel)
