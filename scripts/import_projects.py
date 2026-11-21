"""ทะเบียนโครงการ (ClickUp) + เอกสารจัดซื้อ (TRCloud) → data/projects.json สำหรับหน้าโครงการ
ใช้: python3 scripts/import_projects.py [raw/clickup_STG_<วันที่>.json] [raw/trcloud_project_docs_<วันที่>.json]
    ไม่ใส่ไฟล์ = ใช้ไฟล์ล่าสุดใน raw/
อ่าน config/project_registry.csv (Project ID + หลักฐาน + ผู้ยืนยัน), config/project_exclusions.csv (งานนอกขอบเขต),
config/project_finance_map.csv (เอกสาร TRCloud → Project ID) และ config/stations.csv
ไฟล์ผลลัพธ์อยู่ใน data/ (.gitignore) — มีชื่องาน ชื่อผู้รับผิดชอบ และยอดเงินจริง ห้าม commit
กติกา:
- ตัดรายการซ้ำด้วย ClickUp Task ID · งานย่อยหลายระดับผูกกับ Project ID ที่ใกล้ที่สุดตามสายงานแม่ (ระบุไว้เฉพาะเจาะจงที่สุดชนะ)
- วันที่ทั้งหมดเป็นวันตามเวลา Asia/Bangkok · งานเกินกำหนด = ยังไม่เสร็จ/ไม่ยกเลิก และกำหนดส่ง < วันอ้างอิง (วันที่ดึง ClickUp)
- เงิน: มูลค่า PO (ก่อน VAT) = ภาระผูกพัน · AP ที่อ้าง PO = ยอดบันทึกบัญชี · ภาระคงเหลือ = PO − AP (ไม่บวก PO กับ AP ซ้ำ)
  รวมเข้ายอดโครงการเฉพาะ map_status=confirmed · proposed แสดงแยกเป็น 'คู่ที่เสนอ'"""
import csv, glob, json, os, sys, datetime as dt
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BKK = dt.timezone(dt.timedelta(hours=7))
args = [a for a in sys.argv[1:] if not a.startswith('-')]
def latest(pat):
    fs = sorted(glob.glob(os.path.join(ROOT, 'raw', pat)))
    if not fs: sys.exit('ไม่พบไฟล์ raw/' + pat + ' — ดึงข้อมูลตาม docs/PROJECT-PAGE.md ก่อน')
    return fs[-1]
CU = args[0] if len(args) > 0 else latest('clickup_STG_*.json')
TR = args[1] if len(args) > 1 else latest('trcloud_project_docs_*.json')
cu = json.load(open(CU, encoding='utf-8'))
tr = json.load(open(TR, encoding='utf-8'))
rd = lambda f: list(csv.DictReader(open(os.path.join(ROOT, 'config', f), encoding='utf-8-sig')))
REG, EXC, FIN, ST = rd('project_registry.csv'), rd('project_exclusions.csv'), rd('project_finance_map.csv'), rd('stations.csv')
problems = []

def day(ms):
    return dt.datetime.fromtimestamp(int(ms) / 1000, BKK).date().isoformat() if ms else None
asof = dt.datetime.fromisoformat(cu['fetched_at']).astimezone(BKK).date().isoformat()

# ---------- งาน ClickUp: ตัดซ้ำ + ตัดงานนอกขอบเขต ----------
raw = cu['tasks']
seen, tasks = set(), {}
dups = 0
for t in raw:
    if t['id'] in seen: dups += 1; continue
    seen.add(t['id']); tasks[t['id']] = t
ex_list = {e['clickup_id']: e for e in EXC if e['scope'] == 'list'}
ex_task = {e['clickup_id']: e for e in EXC if e['scope'] == 'task'}
def excluded(t):
    if t['list_id'] in ex_list: return ex_list[t['list_id']]
    x = t
    while x:
        if x['id'] in ex_task: return ex_task[x['id']]
        x = tasks.get(x['parent']) if x.get('parent') else None
    return None
excl = defaultdict(lambda: {'n': 0, 'reason': '', 'by': '', 'at': ''})
scope = {}
for i, t in tasks.items():
    e = excluded(t)
    if e:
        k = e['name']; excl[k]['n'] += 1; excl[k].update(reason=e['reason'], by=e['requested_by'], at=e['requested_at'])
    else: scope[i] = t

# ---------- ผูกงานกับ Project ID ----------
claim = {}
for r in REG:
    for tid in filter(None, r['clickup_tasks'].split(';')):
        if tid in claim: problems.append(f'งาน {tid} ถูกระบุใน {claim[tid]} และ {r["project_id"]}')
        if tid not in tasks: problems.append(f'{r["project_id"]}: ไม่พบงาน {tid} ในไฟล์ ClickUp')
        claim[tid] = r['project_id']
def pid_of(t):
    x = t
    while x:
        if x['id'] in claim: return claim[x['id']]
        x = scope.get(x['parent']) if x.get('parent') else None
    return None
DONE, CXL = 'complete', 'cancelled'
is_open = lambda t: t['status'] not in (DONE, CXL)
TS = []
for i, t in scope.items():
    p = pid_of(t)
    depth, x = 0, t
    while x.get('parent') and x['parent'] in scope: depth += 1; x = scope[x['parent']]
    last = [ln.strip() for ln in (t.get('text') or '').split('\n') if ln.strip() and not ln.startswith('[')]
    TS.append({'id': i, 'name': t['name'].strip(), 'status': t['status'], 'list': t['list'].strip(), 'parent': t['parent'] if t.get('parent') in scope else None,
               'depth': depth, 'pid': p, 'claimed': i in claim, 'due': day(t['due']), 'start': day(t['start']), 'done': day(t['done']) if t['status'] == DONE else None,
               'closed': day(t['closed']), 'updated': day(t['updated']), 'owners': t['assignees'], 'priority': t['priority'],
               'note': (last[-1] if last else '')[:200], 'remark': (t.get('remark') or '')[:200], 'url': t['url'],
               'overdue': is_open(t) and bool(t['due']) and day(t['due']) < asof, 'nodue': is_open(t) and not t['due']})
unmapped = [t for t in TS if not t['pid']]
for t in unmapped: problems.append(f'งาน {t["id"]} {t["name"]} ยังไม่ผูกกับ Project ID')

# ---------- สาขา ----------
stn = {}
for s in ST:
    stn.setdefault(s['station_id'], {'id': s['station_id'], 'co': s['company'], 'name': s['station_name']})

# ---------- เงิน (TRCloud) ----------
docs = {}
for co, c in tr['companies'].items():
    for p in c.get('po', []): docs[(co, 'PO', p['doc_no'])] = dict(p, co=co, type='PO')
aps = defaultdict(list)
for co, c in tr['companies'].items():
    for a in c.get('ap', []):
        if a.get('po'): aps[(co, a['po'])].append(a)
fin_rows = []
for m in FIN:
    k = (m['posting_company'], m['doc_type'], m['doc_no'])
    d = docs.get(k)
    if not d: problems.append(f'finance_map: ไม่พบเอกสาร {k} ในไฟล์ TRCloud'); continue
    pct = float(m['alloc_pct'] or 100) / 100
    linked = aps.get((k[0], k[2]), [])
    booked = sum(a['total'] for a in linked); paid = sum(a['payment'] for a in linked)
    if booked > d['total'] + 0.01: problems.append(f'{k[2]}: ยอด AP ({booked:,.2f}) เกินมูลค่า PO ({d["total"]:,.2f})')
    fin_rows.append({'co': k[0], 'type': k[1], 'doc': k[2], 'line': m['line_id'], 'pid': m['project_id'] or None, 'pct': pct * 100, 'status': m['map_status'],
                     'cls': m['cost_class'], 'evidence': m['evidence'], 'by': m['mapped_by'], 'at': m['mapped_at'], 'cby': m['confirmed_by'], 'cat': m['confirmed_at'],
                     'date': d['issue_date'], 'vendor': d['vendor'], 'note': d['note'], 'station': d['warehouse'], 'po_status': d['status'],
                     'po': round(d['total'] * pct, 2), 'booked': round(booked * pct, 2), 'paid': round(paid * pct, 2),
                     'open': round(max(d['total'] - booked, 0) * pct, 2), 'aps': [a['doc_no'] for a in linked]})
# ตรวจการจัดสรรรวมต่อเอกสารไม่เกิน 100%
alloc = Counter()
for f in fin_rows: alloc[(f['co'], f['doc'])] += f['pct'] if f['pid'] else 0
for k, v in alloc.items():
    if v > 100.001: problems.append(f'{k}: จัดสรรเข้าโครงการรวม {v:.1f}% เกิน 100%')
# AP ซ้ำกับหลาย PO หรือเลขเอกสารซ้ำ
apn = Counter(a['doc_no'] for c in tr['companies'].values() for a in c.get('ap', []))
for n, c in apn.items():
    if c > 1: problems.append(f'AP {n} ซ้ำ {c} ครั้ง')

# ---------- สรุปรายโครงการ ----------
kids = defaultdict(list)
for t in TS:
    if t['parent']: kids[t['parent']].append(t)
def desc(i):
    out = []
    for k in kids.get(i, []): out += [k] + desc(k['id'])
    return out
by = defaultdict(list)
for t in TS:
    if t['pid']: by[t['pid']].append(t)
P = []
for r in REG:
    ts = by.get(r['project_id'], [])
    roots = [t for t in ts if t['claimed']]
    subs = [t for t in ts if not t['claimed']]
    live = [t for t in ts if t['status'] != CXL]
    opn = [t for t in ts if is_open(t)]
    oroots = [t for t in roots if is_open(t)]
    if ts and all(t['status'] == CXL for t in ts): st = 'ยกเลิก'
    elif roots and not oroots: st = 'เสร็จ'
    elif oroots and all(t['status'] == 'on hold' for t in oroots): st = 'พักไว้'
    elif oroots and all(t['status'] == 'not started' for t in oroots) and not any(t['status'] in (DONE, 'in progress') for t in ts): st = 'ยังไม่เริ่ม'
    else: st = 'กำลังดำเนินการ'
    dues = [t['due'] for t in roots if t['due']]
    due = max(dues) if dues else None
    osub = [t for t in subs if is_open(t)]
    nxt = (sorted([t for t in osub if t['due']], key=lambda t: t['due']) or sorted(osub, key=lambda t: t['updated'] or '')
           or sorted([t for t in oroots if t['due']], key=lambda t: t['due']) or oroots)
    sub_base = [t for t in (subs or roots) if t['status'] != CXL]
    co = r['owner_company']
    cos = co.split(':', 1)[1].split('+') if co.startswith('JOINT:') else ([co] if co in ('STG', 'STP', 'TWP') else [])
    f = [x for x in fin_rows if x['pid'] == r['project_id']]
    sumf = lambda rows, k: round(sum(x[k] for x in rows), 2)
    conf = [x for x in f if x['status'] == 'confirmed']; prop = [x for x in f if x['status'] == 'proposed']
    P.append({'pid': r['project_id'], 'kind': r['kind'], 'name': r['name'], 'type': r['type'],
              'co': 'JOINT' if co.startswith('JOINT:') else co, 'cos': cos, 'stations': [stn.get(s, {'id': s, 'co': '', 'name': s}) for s in filter(None, r['station_ids'].split(';'))],
              'deliverable': r['deliverable'], 'reg': r['status'], 'reason': r['reason'], 'evidence': r['evidence'],
              'proposed_by': r['proposed_by'], 'proposed_at': r['proposed_at'], 'confirmed_by': r['confirmed_by'] or None, 'confirmed_at': r['confirmed_at'] or None,
              'site': {'pct': float(r['site_progress']) if r['site_progress'] else None, 'by': r['site_progress_by'] or None, 'at': r['site_progress_at'] or None},
              'status': st, 'due': due, 'overdue_project': st in ('กำลังดำเนินการ', 'ยังไม่เริ่ม', 'พักไว้') and bool(due) and due < asof,
              'owners': sorted({o for t in roots for o in t['owners']}), 'lists': sorted({t['list'] for t in ts}),
              'roots': [t['id'] for t in roots], 'n': len(ts), 'n_open': len(opn), 'n_over': sum(t['overdue'] for t in ts), 'n_nodue': sum(t['nodue'] for t in ts),
              'n_cxl': sum(t['status'] == CXL for t in ts),
              'sub_done': sum(t['status'] == DONE for t in sub_base), 'sub_total': len(sub_base), 'sub_basis': 'งานย่อย' if subs else 'งานหลัก',
              'closed_with_open': [{'id': t['id'], 'name': t['name'], 'open': [d['name'] for d in desc(t['id']) if is_open(d)]} for t in roots
                                   if t['status'] == DONE and any(is_open(d) for d in desc(t['id']))],
              'next': {'id': nxt[0]['id'], 'name': nxt[0]['name'], 'due': nxt[0]['due'], 'overdue': nxt[0]['overdue']} if nxt else None,
              'updated': max([t['updated'] for t in ts if t['updated']] or [None]) if ts else None,
              'fin': {'confirmed': {'po': sumf(conf, 'po'), 'booked': sumf(conf, 'booked'), 'paid': sumf(conf, 'paid'), 'open': sumf(conf, 'open'), 'n': len(conf)},
                      'proposed': {'po': sumf(prop, 'po'), 'booked': sumf(prop, 'booked'), 'paid': sumf(prop, 'paid'), 'open': sumf(prop, 'open'), 'n': len(prop)},
                      'budget': None, 'posting': sorted({x['co'] for x in f})}})
    if not ts: problems.append(f'{r["project_id"]}: ไม่มีงานในขอบเขต')

# ---------- ความครอบคลุมของแหล่งข้อมูล ----------
cov_cu = Counter(p['co'] for p in P)
coverage = {'clickup': {'fetched_at': cu['fetched_at'], 'space': cu['space']['name'], 'spaces_in_workspace': cu['spaces_in_workspace'], 'lists': len(cu['lists']),
                        'raw': len(raw), 'dups': dups, 'in_scope': len(TS), 'excluded': sum(v['n'] for v in excl.values()), 'unmapped': len(unmapped),
                        'by_company': dict(cov_cu),
                        'note': 'Workspace มี Space ชื่อ STG สำหรับธุรกิจสถานี ไม่มี Space STP หรือ TWP แยก — บริษัทของแต่ละรายการระบุจากชื่องาน/สาขา/List และต้องให้เจ้าของงานยืนยัน'},
            'trcloud': {co: {'status': c.get('status', 'ok'), 'fetched_at': tr['fetched_at'], 'po': len(c.get('po', [])), 'ap': len(c.get('ap', [])), 'queries': c.get('queries', [])}
                        for co, c in tr['companies'].items()},
            'trcloud_finding': tr.get('finding', '')}

out = {'meta': {'asof': asof, 'tz': 'Asia/Bangkok', 'generated_at': dt.datetime.now(BKK).isoformat(timespec='seconds'),
                'sources': {'clickup': os.path.basename(CU), 'trcloud': os.path.basename(TR)}},
       'coverage': coverage, 'excluded': [dict(name=k, **v) for k, v in excl.items()],
       'projects': P, 'tasks': TS, 'finance': fin_rows, 'checks': problems}
os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'data', 'projects.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(f'ClickUp {len(raw)} รายการ (ซ้ำ {dups}) · นอกขอบเขต {coverage["clickup"]["excluded"]} · ในขอบเขต {len(TS)} · ทะเบียน {len(P)} รายการ · เอกสารเงิน {len(fin_rows)} · ณ {asof}')
if problems: print('ต้องตรวจ:\n- ' + '\n- '.join(problems))
