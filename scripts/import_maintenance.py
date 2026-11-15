"""นำเข้าใบงานซ่อมบำรุงจากระบบ Factorium (ไฟล์ Excel) → data/maint.json
ใช้: python3 scripts/import_maintenance.py raw/<ไฟล์>.xlsx

- map แผนกของเครื่องจักร → บริษัท/สถานี ด้วย config/maint_departments.csv (แผนกที่ยังไม่ map จะคงไว้และนับไว้ ไม่ตัดทิ้ง)
- อ่าน SLA จากข้อความ "ระดับความด่วน" ตามที่ระบบบันทึกจริง (เช่น "ด่วน SLA 3 วัน" = 3 วัน, "ด่วนมาก SLA 24 ชั่วโมง" = 1 วัน)
  รายการที่ไม่มีตัวเลข SLA จะเป็น null — ไม่ตั้งเกณฑ์เอง
- เก็บชื่อผู้แจ้งซ่อมและผู้รับผิดชอบตามไฟล์ต้นฉบับ (ข้อมูลส่วนบุคคล — อยู่ในชุดข้อมูลที่เข้ารหัสและเปิดได้เฉพาะผู้มีสิทธิ์)
- ไม่เขียนอะไรกลับเข้าระบบต้นทาง
"""
import csv, datetime, json, os, re, sys

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(B, 'data', 'maint.json')
MAP = os.path.join(B, 'config', 'maint_departments.csv')
COLS = {'wo': 'เลขที่ใบงาน', 'status': 'สถานะ', 'reporter': 'ผู้แจ้งซ่อม', 'reported': 'วันที่แจ้งซ่อม', 'kind': 'ประเภทใบงาน',
        'stopped': 'สถานะเครื่องจักรหยุด', 'urgency': 'ระดับความด่วน', 'safety': 'ความปลอดภัย', 'dept': 'แผนกของเครื่องจักร',
        'machine': 'ชื่อเครื่องจักร', 'mtype': 'ประเภทเครื่องจักร', 'symptom': 'อาการเสีย', 'cause': 'สาเหตุอาการเสีย',
        'fix': 'วิธีการแก้ไข', 'assigned': 'วันเวลาที่มอบงาน', 'owner': 'ผู้รับผิดชอบ', 'due': 'วันที่คาดว่าจะเสร็จ',
        'done': 'วันเวลาที่ซ่อมเสร็จ', 'min_assign': 'ระยะเวลาตั้งแต่แจ้งซ่อมถึงมอบหมาย (นาที)',
        'min_close': 'ระยะเวลาตั้งแต่แจ้งซ่อมถึงซ่อมเสร็จ (นาที)', 'score': 'คะแนนการประเมิน'}
CLOSED = ('ปิดงาน', 'ซ่อมแล้ว รอประเมิน')
REJECTED = ('ถูกปฏิเสธ',)

def iso(v):
    if isinstance(v, datetime.datetime): return v.isoformat(timespec='minutes')
    if isinstance(v, datetime.date): return v.isoformat()
    s = str(v or '').strip()
    return s or None

def txt(v, n=300):
    s = re.sub(r'\s+', ' ', str(v or '').replace('\xa0', ' ')).strip()
    return s[:n]

def num(v):
    try: return int(float(v))
    except (TypeError, ValueError): return None

def sla_days(urgency):
    """อ่านจำนวนวันตาม SLA จากข้อความที่ระบบบันทึก — ไม่มีตัวเลข = ไม่กำหนด (None)"""
    s = str(urgency or '')
    m = re.search(r'SLA\s*(\d+)\s*วัน', s)
    if m: return int(m.group(1))
    m = re.search(r'SLA\s*(\d+)\s*ชั่วโมง', s)
    if m: return max(1, round(int(m.group(1)) / 24))
    return None

def main(path):
    try:
        import openpyxl
    except ImportError:
        print('ต้องติดตั้ง openpyxl ก่อน: pip install openpyxl'); sys.exit(1)
    dmap = {}
    for r in csv.DictReader([l for l in open(MAP, encoding='utf-8-sig') if not l.lstrip().startswith('«')]):
        dmap[r['factorium_department'].strip()] = (r['company'].strip(), r['station_id'].strip())

    ws = openpyxl.load_workbook(path, data_only=True, read_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    head = [txt(h, 80) for h in next(rows)]
    idx = {}
    for k, label in COLS.items():
        if label not in head: print('ไม่พบคอลัมน์ "%s" ในไฟล์' % label); sys.exit(1)
        idx[k] = head.index(label)

    out, seen, unmapped, outside = [], set(), {}, {}
    for raw in rows:
        g = lambda k: raw[idx[k]]
        wo = txt(g('wo'), 40)
        if not wo or wo in seen: continue
        seen.add(wo)
        dept = txt(g('dept'), 80)
        co, stid = dmap.get(dept, (None, None))
        if dept in dmap and not co:                       # แผนกของบริษัทนอกกลุ่ม เช่น HEA
            outside[dept] = outside.get(dept, 0) + 1; continue
        if co is None:                                    # ยังไม่มีใน config
            unmapped[dept] = unmapped.get(dept, 0) + 1
        st = txt(g('status'), 40)
        out.append({
            'wo': wo, 'co': co, 'station': stid or None, 'dept': dept,
            'status': st, 'closed': st in CLOSED, 'rejected': st in REJECTED,
            'kind': txt(g('kind'), 60), 'urgency': txt(g('urgency'), 60), 'sla': sla_days(g('urgency')),
            'stopped': txt(g('stopped'), 40), 'safety': txt(g('safety'), 60),
            'machine': txt(g('machine'), 80), 'mtype': txt(g('mtype'), 60),
            'symptom': txt(g('symptom'), 200), 'cause': txt(g('cause'), 200), 'fix': txt(g('fix'), 300),
            'reporter': txt(g('reporter'), 60), 'owner': txt(g('owner'), 60),
            'reported': iso(g('reported')), 'assigned': iso(g('assigned')), 'due': iso(g('due')), 'done': iso(g('done')),
            'min_assign': num(g('min_assign')), 'min_close': num(g('min_close')), 'score': num(g('score')),
        })
    dates = [r['reported'][:10] for r in out if r['reported']]
    doc = {'source': 'Factorium (ไฟล์ Excel ส่งออกจากระบบซ่อมบำรุง)', 'file': os.path.basename(path),
           'imported_at': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
           'from': min(dates) if dates else None, 'to': max(dates) if dates else None,
           'unmapped': unmapped, 'outside_group': outside, 'rows': out}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(doc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('เขียน data/maint.json · %d ใบงาน · %s – %s' % (len(out), doc['from'], doc['to']))
    print('  ระบุสถานีได้ %d · ยังไม่ map %s · นอกกลุ่ม %s'
          % (sum(1 for r in out if r['station']), unmapped or 'ไม่มี', outside or 'ไม่มี'))

if __name__ == '__main__':
    if len(sys.argv) < 2: print('ใช้: python3 scripts/import_maintenance.py raw/<ไฟล์>.xlsx'); sys.exit(2)
    main(sys.argv[1])
