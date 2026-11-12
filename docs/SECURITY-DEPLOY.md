# ความปลอดภัยและการ Deploy: เข้ารหัสข้อมูล + Login Microsoft 365

ชุดนี้คือระบบเดียวกับที่ใช้กับ HEA Sales Executive Dashboard ปรับให้ใช้กับ Dashboard ธุรกิจอื่นได้ (ชื่อตัวแปรเป็น `DASH_*` ไม่ผูกกับ HEA)
ใช้คู่กับ `Sales-Executive-Dashboard-Playbook.md`

## ไฟล์ในชุดนี้

| ไฟล์ | วางที่ใน repo | หน้าที่ |
|---|---|---|
| `scripts/build-static.js` | `scripts/` | รวม `data/*.json` → เข้ารหัส AES-256-GCM → สร้างโฟลเดอร์ `site/` พร้อมหน้า login |
| `public/gate.js` | `public/` | ประตู login: MSAL → ตรวจ tenant/กลุ่ม → ดึงกุญแจจาก SharePoint → ถอดรหัสในเบราว์เซอร์ |
| `public/vendor/msal-browser.min.js` (+ LICENSE) | `public/vendor/` | ไลบรารี login ของ Microsoft (เก็บในเครื่อง ไม่โหลดจาก CDN) |
| `static/gate.css` | `static/` | หน้าตาหน้า login (ใช้ตัวแปรสีของ Dashboard) |
| `static/auth-config.example.js` | คัดลอกเป็น `static/auth-config.js` | ค่า client/tenant/group/ลิงก์กุญแจ (ไม่มีความลับ) |
| `.github/workflows/pages.yml` | `.github/workflows/` | เผยแพร่ `site/` ขึ้น GitHub Pages อัตโนมัติเมื่อ push |

---

## 1. หลักการทำงาน

```
[เครื่องที่ต่อฐานข้อมูลได้]
  data/*.json ──build-static.js + ไฟล์กุญแจ──▶ site/data.enc.js (ข้อมูลเข้ารหัส)
                                                  │ push
                                                  ▼
[GitHub Pages]  site/  (มีแต่ข้อมูลเข้ารหัส + โค้ดหน้าเว็บ)
                                                  │ ผู้ใช้เปิดเว็บ
                                                  ▼
[เบราว์เซอร์ผู้ใช้]
  1. Login Microsoft 365 (MSAL, redirect)
  2. ตรวจ tid = tenant บริษัท และ groups มี groupId
  3. เรียก Microsoft Graph ด้วยสิทธิ์ของผู้ใช้เอง อ่านไฟล์กุญแจจากลิงก์แชร์ SharePoint
  4. ถอดรหัส AES-GCM ด้วย WebCrypto → เปิด Dashboard (ข้อมูลอยู่ในหน่วยความจำเท่านั้น)
```

**อะไรป้องกันอะไร**

| ชั้น | ป้องกัน | หมายเหตุ |
|---|---|---|
| เข้ารหัส AES-256-GCM | คนที่เปิดไฟล์บน GitHub ได้ (repo public หรือคนนอกที่รู้ URL) | ไม่มีกุญแจ = อ่านไม่ได้ และแก้ข้อมูลไม่ได้โดยไม่ถูกจับ (GCM ตรวจความถูกต้อง) |
| สิทธิ์อ่านไฟล์กุญแจใน SharePoint | **ด่านจริง** ว่าใครถอดรหัสได้ | ถอดสิทธิ์ที่นี่ = คนนั้นเปิดรายงานไม่ได้อีก |
| ตรวจ tenant + กลุ่มใน gate.js | กันคนนอกองค์กร/นอกกลุ่ม พร้อมข้อความแจ้งที่ชัด | ตรวจฝั่งเบราว์เซอร์ จึงเป็นด่านเสริม ไม่ใช่ด่านหลัก |
| `noindex, nofollow` | ไม่ให้ search engine เก็บหน้า | |
| MSAL cache ใน `sessionStorage` | ปิดแท็บแล้วต้อง login ใหม่ | |

**ข้อจำกัดที่ต้องรู้**
- ผู้มีสิทธิ์ดูเห็นข้อมูลทั้งชุดในเบราว์เซอร์ (รวมแถวที่ตัวกรองซ่อน) จึงห้ามใส่ข้อมูลเกินที่ Dashboard ต้องใช้ตั้งแต่ใน SQL
- ถ้ากุญแจหลุด ข้อมูลเก่าใน **ประวัติ Git** ที่เข้ารหัสด้วยกุญแจนั้นจะถูกอ่านได้ การเปลี่ยนกุญแจปกป้องเฉพาะข้อมูลใหม่ ดังนั้นต้องเก็บกุญแจให้ดีตั้งแต่แรก
- ใช้ **กุญแจคนละชุดต่อ Dashboard** (ห้ามใช้กุญแจของ Dashboard ธุรกิจน้ำ)

---

## 2. ตั้งค่า Microsoft Entra ID (ครั้งแรก, ต้องเป็นผู้ดูแล M365)

### 2.1 กลุ่มผู้มีสิทธิ์ดู
1. Entra admin center → Groups → New group → **Security** · ชื่อเช่น `<ธุรกิจ>_dashboard_viewers`
2. เพิ่มสมาชิก (CEO, CSO, ผู้จัดการ, IT) → จด **Object ID** ของกลุ่ม

### 2.2 App registration
ใช้ App เดิมของ HEA ได้ (เพิ่ม Redirect URI) หรือสร้างใหม่ (แนะนำแยกกัน เพื่อถอนสิทธิ์แยกได้)
1. App registrations → New registration → ชื่อ `<ธุรกิจ> Sales Dashboard` · **Accounts in this organizational directory only**
2. Authentication → Add a platform → **Single-page application** → Redirect URI `https://<owner>.github.io/<repo>/` (มี `/` ท้าย ตัวพิมพ์ตรงกับ URL จริง)
   - ถ้าจะทดสอบในเครื่อง เพิ่ม `http://localhost:8080/` ด้วย
3. API permissions → Microsoft Graph → **Delegated**: `User.Read`, `Files.Read.All` → **Grant admin consent** (กันผู้ใช้เจอหน้าขอสิทธิ์)
4. Token configuration → Add groups claim → **Security groups** → ติ๊กใน **ID** token
5. จด **Application (client) ID** และ **Directory (tenant) ID**
6. (แนะนำ) Enterprise applications → app นี้ → Properties → **Assignment required = Yes** → Users and groups → เพิ่มกลุ่มจาก 2.1 · คนนอกกลุ่มจะ login เข้า app นี้ไม่ได้ตั้งแต่ฝั่ง Microsoft

> ถ้าผู้ใช้อยู่ในกลุ่มเกิน ~200 กลุ่ม token จะไม่ส่งรายการกลุ่ม (groups overage) gate.js จะแจ้งให้ติดต่อ IT · ทางแก้: ใช้ Assignment required (ข้อ 6) แล้วเว้น `groupId` ว่าง

---

## 3. สร้างกุญแจและวางใน SharePoint

1. บนเครื่องที่ build (ไม่ใช่ในโฟลเดอร์ repo):
   ```bash
   node scripts/build-static.js --key /secure/<ธุรกิจ>-dash-key.txt --out site
   ```
   ครั้งแรกถ้าไฟล์ยังไม่มี สคริปต์จะสร้างกุญแจใหม่ (base64 ของ 32 ไบต์, สิทธิ์ไฟล์ 600) · สคริปต์ปฏิเสธถ้า path กุญแจอยู่ในโฟลเดอร์เว็บ
2. อัปโหลดไฟล์กุญแจไป SharePoint/OneDrive ในที่ที่จำกัดสิทธิ์ (เช่น site ของ IT)
3. แชร์ไฟล์ → **Specific people** → ใส่กลุ่มจาก 2.1 (สิทธิ์ **View**) → Copy link
4. ใส่ลิงก์ใน `keyShareUrl` ของ `static/auth-config.js`
5. เก็บสำเนากุญแจสำรองใน password manager/ที่ปลอดภัยของ IT · **ห้าม commit, ห้ามส่งทางแชท/อีเมล, ห้ามใส่ใน zip**

---

## 4. ตั้งค่า repo และ GitHub Pages

1. สร้าง repo ใหม่ · `.gitignore` ต้องมี `data/*.json`, `keys/`, `*key*.txt`, `.env`, `.env.*` (ดู Playbook หัวข้อ 10.1)
2. วางไฟล์ตามตารางด้านบน · คัดลอก `static/auth-config.example.js` เป็น `static/auth-config.js` แล้วใส่ค่าจริง
3. แก้ `BRAND` บนสุดของ `scripts/build-static.js` (ชื่อ Dashboard คำอธิบาย โลโก้ alt) ตาม CI
4. ต่อ `public/app.js` เข้ากับ gate (ดูหัวข้อ 5)
5. GitHub → Settings → Pages → Source = **GitHub Actions** · workflow `pages.yml` จะเผยแพร่ `site/` ทุกครั้งที่ push ไฟล์ใน `site/`
6. push ครั้งแรก → เปิด `https://<owner>.github.io/<repo>/` ทดสอบตามหัวข้อ 7

`index.html` ใน `public/` ต้องมีข้อความเหล่านี้ตรงตัว (build-static.js ใช้แทรกหน้า login) ถ้าไม่มีสคริปต์จะหยุดและบอกว่าขาดอะไร:
- `<meta name="viewport" content="width=device-width, initial-scale=1">`
- `<link rel="stylesheet" href="styles.css">`
- `<div class="app">`
- `<div class="hdr-user" id="hdr-user"></div>`
- `<script src="app.js"></script>`

---

## 5. ต่อ app.js กับ gate

โหมด static ไม่มี API ข้อมูลทั้งหมดมาจาก bundle ที่ถอดรหัสแล้ว:

```js
// bundle = { config: { mode:'snapshot', asof_default, snapshot, history_months, datasets:[...] }, ds: { <ชื่อ>: <JSON ของ SQL ชุดนั้น> } }
// ทุกที่ที่ดึงข้อมูลผ่าน getJSON() — โหมด static อ่านจาก bundle แทน fetch (แบบเดียวกับ HEA)
async function getJSON(url) {
  if (S.bundle) {
    if (url === '/api/config') return S.bundle.config;
    const name = url.replace(/^\/api\/ds\//, '').split('?')[0];
    if (!(name in S.bundle.ds)) throw new Error('ไม่มีชุดข้อมูล ' + name);
    return { data: S.bundle.ds[name], fetched_at: S.bundle.config.snapshot.fetched_at, asof: S.bundle.config.snapshot.asof, mode: 'snapshot' };
  }
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

// ท้ายไฟล์ app.js
if (window.DASH_STATIC) window.DASHApp = { start: (bundle) => { S.bundle = bundle; boot(); } };
else boot();   // โหมด server (พัฒนาในเครื่อง)
```

- build-static.js ใส่ `window.DASH_STATIC = 1` ให้เอง และโหลดไฟล์ตามลำดับ msal → auth-config → data.enc → app → gate
- ห้ามเรียก `boot()` เองในโหมด static (gate.js เรียก `DASHApp.start` หลังถอดรหัสสำเร็จ)
- ห้ามบันทึก bundle ลง localStorage/sessionStorage

---

## 6. รอบอัปเดตข้อมูล

```bash
# 1) ดึงข้อมูลใหม่ (อ่านอย่างเดียว) → data/*.json   (ไม่ขึ้น Git)
# 2) ตรวจ
python3 scripts/validate.py          # ต้องได้ 0 ❌
# 3) build ด้วยกุญแจเดิม
node scripts/build-static.js --key /secure/<ธุรกิจ>-dash-key.txt --out site
# 4) commit เฉพาะ site/ (และโค้ดที่แก้) แล้ว push → GitHub Actions เผยแพร่เอง
```

- ทุก build ใช้ IV ใหม่ และต่อท้าย `?v=<เวลา build>` ให้ไฟล์ js/css กัน cache เก่า
- ผู้ใช้กด Ctrl+F5 ถ้ายังเห็นข้อมูลเก่า

---

## 7. ทดสอบหลัง deploy

| กรณี | ผลที่ต้องได้ |
|---|---|
| บัญชีในกลุ่ม | login → เปิด Dashboard · แถบบนแสดงชื่อ + ปุ่มออกจากระบบ |
| บัญชีในองค์กรแต่ไม่อยู่ในกลุ่ม | "บัญชีนี้ยังไม่มีสิทธิ์ดูรายงาน (ต้องอยู่ในกลุ่ม …)" (หรือ Microsoft ปฏิเสธถ้าเปิด Assignment required) |
| บัญชีนอกองค์กร | "บัญชีนี้ไม่ได้อยู่ในองค์กร" |
| อยู่ในกลุ่มแต่ยังไม่ได้แชร์ไฟล์กุญแจ | "บัญชีนี้ยังไม่ได้รับสิทธิ์อ่านไฟล์กุญแจใน SharePoint" |
| กุญแจไม่ตรงกับข้อมูล | "ไฟล์กุญแจใน SharePoint ไม่ตรงกับข้อมูลชุดนี้" |
| เปิด `site/data.enc.js` ตรงๆ | เห็นแต่ข้อความเข้ารหัส |
| ค้นใน repo | ไม่มีไฟล์กุญแจ, `data/*.json`, รหัสผ่าน, connection string |

---

## 8. งานดูแล

| เหตุการณ์ | ทำอะไร |
|---|---|
| เพิ่มผู้ดู | เพิ่มเข้ากลุ่ม (ถ้าแชร์กุญแจให้กลุ่มไว้แล้ว ไม่ต้องทำอย่างอื่น) |
| ถอนสิทธิ์ | เอาออกจากกลุ่ม · ตรวจว่าไม่ได้แชร์ไฟล์กุญแจให้รายบุคคลค้างไว้ |
| กุญแจหลุด/สงสัยหลุด | สร้างกุญแจใหม่ (`--key` ชี้ path ที่ยังไม่มีไฟล์) → build → push → แทนไฟล์ใน SharePoint (ลิงก์ใหม่ใส่ `keyShareUrl`) · พิจารณาลบประวัติ `site/` เก่าใน Git ถ้าข้อมูลอ่อนไหว |
| เปลี่ยน URL/ชื่อ repo | แก้ Redirect URI ใน App registration ให้ตรง |
| Secret ของ App | ไม่มี (SPA ใช้ PKCE) จึงไม่มีอะไรหมดอายุ |

---

## 9. Checklist ก่อนส่งลิงก์ให้ผู้บริหาร

- [ ] กลุ่มผู้ดู + App registration (SPA, Redirect URI, User.Read + Files.Read.All + admin consent, groups claim)
- [ ] กุญแจชุดใหม่ เก็บนอก repo มีสำเนาสำรอง · แชร์ใน SharePoint เฉพาะกลุ่ม (View)
- [ ] `auth-config.js` ครบ 5 ค่า · `BRAND` ใน build-static.js เป็นของธุรกิจนี้
- [ ] `.gitignore` กันข้อมูลดิบ/กุญแจ · ค้นใน repo ไม่เจอความลับ
- [ ] Pages Source = GitHub Actions · workflow ผ่าน
- [ ] ทดสอบครบทุกกรณีในหัวข้อ 7 (อย่างน้อยบัญชีในกลุ่ม 1 คน และนอกกลุ่ม 1 คน)
