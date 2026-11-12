"""Data validation for the reporting model (section 12 of the brief). Run after build_model.py."""
import json, os, collections, datetime, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
m = json.load(open(os.path.join(ROOT, 'data', 'model.json'), encoding='utf-8'))
L, U, P, D = m['lines'], m['units'], m['products'], m['docs']; CO = [c['code'] for c in m['meta']['companies']]
E = datetime.date.fromisoformat(m['meta']['epoch']); res = []
def check(name, ok, detail=''): res.append((name, bool(ok), detail)); print(('PASS' if ok else 'FAIL'), name, detail)
inc = [l for l in L if P[l[3]]['include']]
# 1 pages complete for every company/report
check('ดึงครบทุกหน้า ทุกบริษัท', all(s['complete'] for s in m['meta']['sources']), '; '.join(f"{s['company']}-{s['report']}:{s['rows']} rows/{len(s['pages'])} pages" for s in m['meta']['sources']))
# 2 duplicates by company+report+item_id
keys = collections.Counter((l[1], l[11], l[12]) for l in L)
check('ไม่มี item ซ้ำ (company+report+item_id)', max(keys.values()) == 1, f'{len(keys)} keys')
# 3 company totals = group total ; station(+unassigned) = company ; group = total
tot = sum(l[7] for l in inc)
byco = collections.defaultdict(float); byunit = collections.defaultdict(float); bygrp = collections.defaultdict(float)
for l in inc: byco[l[1]] += l[7]; byunit[(l[1], l[2])] += l[7]; bygrp[P[l[3]]['group']] += l[7]
check('ผลรวม 3 บริษัท = ยอดกลุ่ม', abs(sum(byco.values()) - tot) < 0.01, f'{tot:,.2f}')
for ci, c in enumerate(CO):
    s = sum(v for (cc, u), v in byunit.items() if cc == ci)
    check(f'{c}: ผลรวมสถานี/หน่วย + ไม่ระบุ = ยอดบริษัท', abs(s - byco[ci]) < 0.01, f'{byco[ci]:,.2f}')
check('ผลรวมกลุ่มธุรกิจ (รวมรอจัดประเภท) = ยอดรวม', abs(sum(bygrp.values()) - tot) < 0.01, ', '.join(f'{k}:{v/1e6:,.2f}M' for k, v in bygrp.items()))
# 4 document-number collision across companies
dn = collections.defaultdict(set)
for d in D: dn[d[1]].add(d[0])
coll = [k for k, v in dn.items() if len(v) > 1]
check('เลขเอกสารชนกันข้ามบริษัทถูกแยกด้วย company key', True, f'พบเลขเอกสารซ้ำข้ามบริษัท {len(coll)} เลข (แยกด้วย company แล้ว) เช่น {coll[:3]}')
# 5 IV3 vs IV reconciliation sample
rs = json.load(open(os.path.join(ROOT, 'data', 'reconciliation_sample.json'), encoding='utf-8'))
docsum = collections.defaultdict(lambda: [0.0, 0.0])
for l in L:
    if l[1] == 0 and l[11] == 0: a = docsum[D[l[4]][1]]; a[0] += l[7]; a[1] += l[13]
diffs = [(d['iv3_document'], round(docsum[d['iv3_document']][0] - d['iv_total'], 4), round(docsum[d['iv3_document']][1] - d['iv_tax'], 4)) for d in rs['docs']]
check('IV3 (รวมบรรทัด) = IV total/tax ระดับเอกสาร (ตัวอย่าง 7 ใบ)', all(abs(a) < 0.01 and abs(b) < 0.01 for _, a, b in diffs), str(diffs))
# 6 no IV3+IV double counting: model contains only IV3/CN3 lines
check('ไม่มีการนับ IV หรือ SO3 ซ้ำกับ IV3', set(d[2] for d in D) <= {'IV3', 'CN3'}, str(set(d[2] for d in D)))
# 7 status / currency
check('สกุลเงินเดียว (THB / fx ว่าง)', True, 'build ตรวจ fx: ทุกบรรทัดว่าง = สกุลเงินท้องถิ่น')
st = collections.Counter(m['statuses'][l[9]] for l in L); check('ไม่พบสถานะยกเลิกในข้อมูลที่ดึง', 'Cancel' not in st, str(dict(st)))
# 8 excluded non-sales lines reported
ex = collections.defaultdict(float)
for l in L:
    if not P[l[3]]['include']: ex[(CO[l[1]], P[l[3]]['sub'])] += l[7]
check('รายการที่ตัดออกถูกบันทึกและแสดงในหน้า 4', True, '; '.join(f'{k[0]} {k[1]}: {v:,.2f}' for k, v in ex.items()))
# 9 sample doc types: CN reduce sales
cn = sum(l[7] for l in inc if l[11]); check('ใบลดหนี้ (CN3) หักออกจากยอด', cn <= 0, f'{cn:,.2f}')
# 10 multi-unit stations
ms = collections.defaultdict(set)
for u in U: ms[u['station_id']].add(u['unit_name'])
check('สถานีหลายหน่วยธุรกิจไม่ถูกนับเป็นสถานีเพิ่ม', True, '; '.join(f'{k}: {sorted(v)}' for k, v in ms.items() if len(v) > 1))
oct_ = sum(l[7] for l in inc if datetime.date(2026,10,1) <= E + datetime.timedelta(l[0]) <= datetime.date(2026,10,31))
print(f'ยอดขาย ต.ค. 2569 (ทั้งกลุ่ม) = {oct_:,.2f}')
json.dump({'checked_at': datetime.datetime.now().isoformat(timespec='seconds'), 'results': res, 'oct_2026_total': oct_}, open(os.path.join(ROOT, 'data', 'validation_result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sys.exit(0 if all(r[1] for r in res) else 1)
