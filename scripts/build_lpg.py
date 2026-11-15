"""อ่าน config/lpg_factor.csv → data/lpg.json (ค่าแปลงหน่วย LPG พร้อมวันที่มีผลและผู้ยืนยัน)
เก็บเป็นประวัติ: การแก้ค่าปัจจุบันไม่เปลี่ยนผลย้อนหลัง เพราะเว็บเลือกแถวตามวันที่ของเอกสาร
ใช้: python3 scripts/build_lpg.py"""
import csv, json, os, sys

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(B, 'config', 'lpg_factor.csv')
OUT = os.path.join(B, 'data', 'lpg.json')
NEED = ['company', 'station_id', 'product_id', 'effective_from', 'effective_to', 'factor', 'source', 'confirmed_by', 'confirmed_at', 'note']

rows, problems = [], []
with open(SRC, encoding='utf-8-sig') as f:
    lines = [l for l in f if not l.lstrip().startswith('«')]          # บรรทัดอธิบายขึ้นต้นด้วย «
    for i, r in enumerate(csv.DictReader(lines), 1):
        miss = [k for k in NEED if k not in r]
        if miss:
            problems.append('แถว %d: ไม่มีคอลัมน์ %s' % (i, ', '.join(miss))); continue
        try:
            fac = float(r['factor'])
        except ValueError:
            problems.append('แถว %d: factor ไม่ใช่ตัวเลข (%r)' % (i, r['factor'])); continue
        if not (0.5 < fac < 5):
            problems.append('แถว %d: factor %.3f อยู่นอกช่วงที่สมเหตุสมผล 0.5–5 ลิตร/กก.' % (i, fac)); continue
        if not r['effective_from'] or not r['source'] or not r['confirmed_by']:
            problems.append('แถว %d: ต้องระบุ effective_from, source และ confirmed_by' % i); continue
        rows.append({'co': r['company'].strip() or '*', 'station': r['station_id'].strip() or '*', 'product': r['product_id'].strip() or '*',
                     'from': r['effective_from'].strip(), 'to': r['effective_to'].strip() or None, 'factor': fac,
                     'source': r['source'].strip(), 'by': r['confirmed_by'].strip(), 'at': r['confirmed_at'].strip(), 'note': r['note'].strip()})

if problems:
    print('config/lpg_factor.csv มีปัญหา:\n- ' + '\n- '.join(problems)); sys.exit(1)
if not rows:
    print('config/lpg_factor.csv ไม่มีข้อมูล'); sys.exit(1)

doc = {
    'unit': 'ลิตรต่อกิโลกรัม',
    'formulas': ['กก. → ลิตร = กก. × factor', 'ลิตร → กก. = ลิตร ÷ factor', 'บาท/กก. → บาท/ลิตร = บาท/กก. ÷ factor'],
    'vat_rule': 'เปรียบเทียบต้นทุนกับราคาขายบนฐานก่อน VAT เสมอ — ชุดข้อมูลเก็บ before_vat และ vat แยกกันตามเอกสาร '
                'ไม่ถอดหรือบวก VAT ซ้ำ · ถ้าต้นทุนที่ได้มารวม VAT ให้หารด้วย (1 + อัตราภาษีของรายการนั้น) ก่อนแปลงหน่วย',
    'applies': 'รายงานทุกหน้าเก็บปริมาณและหน่วยตามเอกสารต้นฉบับ และไม่รวมลิตรกับกิโลกรัมเป็นยอดเดียว '
               'ค่าแปลงนี้ใช้เฉพาะช่องที่เขียนกำกับว่า "เทียบเท่าลิตร" เท่านั้น',
    'rows': rows,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(doc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('เขียน data/lpg.json ·', len(rows), 'แถว · ค่าตั้งต้น', rows[0]['factor'], 'ลิตร/กก.')
