"""ใบปรับปรุงสต๊อกจากการตรวจนับสิ้นเดือน (LPG/น้ำมัน) → data/stock.json (หน้าบริษัทและสถานี)
Input : raw/stg_stockadj_<asof>.csv และ raw/stp_twp_stockadj_<asof>.csv
        ดึงด้วย search_gr keyword=ปรับปรุง (user อ่านอย่างเดียว) แล้วคัดเฉพาะใบตรวจนับ LPG/น้ำมัน
Output: data/stock.json = {asof, adj:[[co, dept, 'YYYY-MM', qty, doc]]}"""
import csv, glob, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, OUT = os.path.join(ROOT, 'raw'), os.path.join(ROOT, 'data')
adj, asofs = [], set()
def rows(f):
    return csv.reader(l for l in open(f, encoding='utf-8') if l.strip() and not l.startswith('#'))
for pat, fixed in (('stg_stockadj_*.csv', 'STG'), ('stp_twp_stockadj_*.csv', None)):
    fs = sorted(glob.glob(os.path.join(RAW, pat)))
    if not fs: print('ไม่พบไฟล์', pat); raise SystemExit(1)
    f = fs[-1]; asofs.add(re.search(r'_(\d{4}-\d\d-\d\d)\.csv$', f).group(1))
    for r in rows(f):
        if r[0] in ('month', 'co'): continue
        co, r = (fixed, r) if fixed else (r[0], r[1:])
        adj.append([co, r[1], r[0], round(float(r[2]), 2), r[3]])
json.dump({'asof': max(asofs), 'adj': adj}, open(os.path.join(OUT, 'stock.json'), 'w', encoding='utf-8'), ensure_ascii=False)
for co in ('STG', 'STP', 'TWP'):
    x = [a for a in adj if a[0] == co]; print(co, len(x), 'ใบ', f'{sum(a[3] for a in x):,.0f} ลิตร')
print('เขียน data/stock.json')
