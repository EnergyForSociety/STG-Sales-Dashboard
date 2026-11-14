"""ลูกหนี้ค้างรับ / เจ้าหนี้ค้างจ่ายรายเอกสาร → data/wc.json (หน้าเงินทุนหมุนเวียน)
Input : raw/<co>_ar_<asof>.json (get_receivable_due date=2027-12-31) และ raw/<co>_ap_<asof>.json (get_payable_due)
        ดึงด้วย user อ่านอย่างเดียว · ใช้ไฟล์ asof ล่าสุดของแต่ละบริษัท
Output: data/wc.json = {asof, docs:[[co, side, code, name, ctype, due, amount, overdue, doc, issue, dept, status]]}"""
import json, glob, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, OUT = os.path.join(ROOT, 'raw'), os.path.join(ROOT, 'data')
docs, asofs, seen = [], set(), set()
for co in ('stg', 'stp', 'twp'):
    for side in ('ar', 'ap'):
        fs = sorted(glob.glob(os.path.join(RAW, f'{co}_{side}_*.json')))
        if not fs:
            print('ไม่พบไฟล์', co, side); sys.exit(1)
        f = fs[-1]; asofs.add(re.search(r'_(\d{4}-\d\d-\d\d)\.json$', f).group(1))
        d = json.load(open(f, encoding='utf-8'))
        for r in d['result']:
            key = (co, side, r['document'])
            if key in seen: continue
            seen.add(key)
            name = (r.get('organization') or '').strip() or (r.get('vendor') or '').strip() or r['code']
            docs.append([co.upper(), side.upper(), r['code'], name, r.get('contact_type', ''), r['due_date'], round(float(r['amount']), 2),
                         int(float(r.get('overdue') or 0)), r['document'], r.get('issue_date', ''), r.get('department', ''), r.get('status', '')])
asof = max(asofs)
json.dump({'asof': asof, 'docs': docs}, open(os.path.join(OUT, 'wc.json'), 'w', encoding='utf-8'), ensure_ascii=False)
for co in ('STG', 'STP', 'TWP'):
    for side in ('AR', 'AP'):
        rows = [x for x in docs if x[0] == co and x[1] == side]
        print(co, side, len(rows), f'{sum(x[6] for x in rows):,.2f}')
print('เขียน data/wc.json · ณ', asof)
