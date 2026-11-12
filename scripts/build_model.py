"""STG Group Sales Dashboard — build reporting model from raw TRCloud snapshots.

Input : raw/<co>_<report>_<scope>_p<N>.json  (exact JSON returned by TRCloud MCP)
        config/stations.csv, config/product_rules.csv, config/data_confirmations.csv
Output: data/model.json, data/lines.csv, dashboard/data.js, data/refresh_log.json
Rules : key = company + item_id (line) / company + document (doc). Never mixes IV3 with IV.
        A company whose pages are incomplete is flagged; previous good snapshot is kept
        (see README: refresh procedure)."""
import json, glob, csv, os, re, datetime, collections, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, CFG, OUT = [os.path.join(ROOT, d) for d in ('raw', 'config', 'data')]
os.makedirs(OUT, exist_ok=True)
TZ = datetime.timezone(datetime.timedelta(hours=7))
COMPANIES = [
    {'code': 'STG', 'id': 13, 'name': 'บริษัท สตาร์แก๊ส จำกัด', 'role': 'บริษัทแม่'},
    {'code': 'STP', 'id': 15, 'name': 'บริษัท สตาร์ปิโตรเลียม พลัส จำกัด', 'role': 'บริษัทลูกของ STG'},
    {'code': 'TWP', 'id': 14, 'name': 'บริษัท ธวัชภิญโญ จำกัด', 'role': 'บริษัทลูกของ STG'},
]
EPOCH = datetime.date(2026, 1, 1)

def read_csv(n):
    with open(os.path.join(CFG, n), encoding='utf-8') as f:
        return list(csv.DictReader(f))

stations = read_csv('stations.csv')
rules = sorted(read_csv('product_rules.csv'), key=lambda r: int(r['priority']))
confirm = read_csv('data_confirmations.csv')
chan_rules = sorted(read_csv('channel_rules.csv'), key=lambda r: int(r['priority']))
CHANNELS = ['ค้าปลีก', 'ค้าส่ง']

def channel(x, dept):
    for r in chan_rules:
        f, v = r['match_field'], r['match_value']
        if (f == 'any' or (f == 'dept_code' and dept == v) or (f == 'doc_type_contains' and v in (x.get('doc_type') or ''))
                or (f == 'contact_type' and (x.get('contact_type') or '') == v)):
            return CHANNELS.index(r['channel'])
    return 0

def classify(x):
    for r in rules:
        f = r['match_field']
        if f == 'any' or (x.get(f) or '') == r['match_value']:
            if r['name_contains'] and r['name_contains'] not in (x.get('product_name') or '') + (x.get('invoice_note') or ''):
                continue
            return r
    raise RuntimeError('no rule')

def load_pages(co, rep):
    files = sorted(glob.glob(os.path.join(RAW, f'{co.lower()}_{rep}_*_p*.json')),
                   key=lambda p: int(re.search(r'_p(\d+)\.json$', p).group(1)))
    rows, pages, ok, fetched = [], [], True, None
    for p in files:
        d = json.load(open(p, encoding='utf-8'))
        r = d.get('result', [])
        good = d.get('success') == 1 and str(d.get('HTTP', '')).startswith('200')
        ok &= good
        t = datetime.datetime.fromtimestamp(os.path.getmtime(p), TZ)
        fetched = max(fetched, t) if fetched else t
        pages.append({'file': os.path.basename(p), 'rows': len(r), 'http': d.get('HTTP'), 'ok': good})
        rows += r
    # a page shorter than the limit (5000) marks the last page; all full pages => maybe more data
    complete = ok and (not pages or pages[-1]['rows'] < 5000)
    return rows, pages, complete, fetched

unit_idx, units = {}, []
def unit_of(co, dept):
    k = (co, dept)
    if k in unit_idx: return unit_idx[k]
    m = next((s for s in stations if s['company'] == co and s['dept_code'] == dept), None)
    if m is None:
        m = {'company': co, 'dept_code': dept, 'station_id': f'{co}-?{dept}', 'station_name': f'ไม่รู้จักแผนก {dept} ({co})',
             'unit_name': 'ไม่ระบุ', 'business_group': '', 'brand': '', 'expected_source': 'ไม่ทราบ',
             'station_type': 'ไม่ใช่สถานี', 'mapping_status': 'รอตรวจสอบ: ไม่พบใน mapping', 'note': ''}
    unit_idx[k] = len(units); units.append(m); return unit_idx[k]

def idx(table, lookup, key, val):
    if key not in lookup: lookup[key] = len(table); table.append(val)
    return lookup[key]

products, prod_l, docs, doc_l, contacts, cont_l = [], {}, [], {}, [], {}
statuses, stat_l = [], {}
lines, refresh = [], {'generated_at': datetime.datetime.now(TZ).isoformat(timespec='seconds'), 'sources': []}
seen = set(); dup = 0; company_ok = {}
for ci, c in enumerate(COMPANIES):
    for rep, sign in (('iv3', 1), ('cn3', -1)):
        rows, pages, complete, fetched = load_pages(c['code'], rep)
        refresh['sources'].append({'company': c['code'], 'report': rep.upper(), 'date_from': '2026-01-01', 'date_to': '2026-11-12',
                                   'pages': pages, 'rows': len(rows), 'complete': complete,
                                   'fetched_at': fetched.isoformat(timespec='seconds') if fetched else None})
        company_ok[c['code']] = company_ok.get(c['code'], True) and complete and bool(pages)
        for x in rows:
            key = (c['code'], rep, x['item_id'])
            if key in seen: dup += 1; continue
            seen.add(key)
            r = classify(x)
            u = unit_of(c['code'], x.get('department') or '')
            group = r['business_group']
            ust = units[u]
            if group == '@station':  # e.g. PT-POINT: discount billed back to PT belongs to the station's fuel business
                group = ust['business_group'] or {'STG': 'LPG', 'STP': 'น้ำมัน'}.get(c['code'], 'อื่น ๆ / รอจัดประเภท')
            brand = ust['brand'] if group in ('น้ำมัน', 'LPG', 'NGV') else (r['sub_unit'] if group == 'Non-Oil' else '')
            if group == 'น้ำมัน' and not brand:
                brand = {'STP': 'PT', 'TWP': 'PTT'}.get(c['code'], 'ไม่ระบุ')
            p = idx(products, prod_l, (c['code'], x['product_id'], r['sub_unit'], group),
                    {'co': c['code'], 'id': x['product_id'], 'cat': x.get('product_category') or '', 'group': group,
                     'sub': r['sub_unit'], 'brand': brand, 'rule_status': r['rule_status'], 'include': r['include_in_sales'] == 'yes',
                     'vol_unit': r['volume_unit_ok'], 'names': collections.Counter()})
            products[p]['names'][x['product_name'][:60]] += 1
            d = idx(docs, doc_l, (c['code'], rep, x['document']),
                    [ci, x['document'], rep.upper(), x['doc_type'], x.get('reference') or ''])
            k = idx(contacts, cont_l, (c['code'], x.get('code') or ''),
                    [x.get('code') or '', (x.get('customer_organization') or x.get('customer_name') or '').replace('\xa0', ' ').strip()])
            s = idx(statuses, stat_l, x['status'], x['status'])
            unit = (x.get('unit') or '').strip()
            qty = float(x.get('quantity') or 0)
            vol_ok = 1 if (r['volume_unit_ok'] and unit == r['volume_unit_ok']) else (2 if (r['volume_unit_ok'] and unit == '') else 0)
            cost = x.get('cost')
            dd = (datetime.date.fromisoformat(x['issue_date']) - EPOCH).days
            lines.append([dd, ci, u, p, d, round(sign * qty, 4), vol_ok, round(sign * float(x['before_vat']), 4),
                          None if cost in (None, '') else round(sign * float(cost), 4), s, k, 1 if rep == 'cn3' else 0,
                          x['item_id'], round(sign * float(x['vat']), 4), channel(x, x.get('department') or '')])

# register mapped stations/units that have no lines so they show as 'ไม่พบรายการ' (never as zero sales)
for st in stations:
    if st['company'] in company_ok: unit_of(st['company'], st['dept_code'])
for p in products:
    p['name'] = p.pop('names').most_common(1)[0][0]
model = {
    'meta': {'title': 'STG Group Sales Executive Dashboard', 'epoch': EPOCH.isoformat(), 'timezone': 'Asia/Bangkok',
             'generated_at': refresh['generated_at'], 'companies': COMPANIES, 'company_ok': company_ok,
             'duplicates_skipped': dup, 'sources': refresh['sources'],
             'channels': CHANNELS, 'line_fields': ['day', 'company', 'unit', 'product', 'doc', 'qty', 'vol_ok(1=unit ok,2=unit blank,0=n/a)', 'amount_ex_vat',
                             'cost', 'status', 'contact', 'is_credit_note', 'item_id', 'vat', 'channel(0=ค้าปลีก,1=ค้าส่ง)']},
    'units': units, 'products': products, 'docs': docs, 'contacts': contacts, 'statuses': statuses,
    'confirmations': confirm, 'lines': lines,
}
json.dump(model, open(os.path.join(OUT, 'model.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(refresh, open(os.path.join(OUT, 'refresh_log.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# ข้อมูลสำหรับ build-static.js (เข้ารหัสก่อนขึ้นเว็บ) — data/ ไม่ขึ้น Git
fetched = max((x['fetched_at'] for x in refresh['sources'] if x['fetched_at']), default=None)
last_day = (EPOCH + datetime.timedelta(max(l[0] for l in lines))).isoformat()
json.dump({'asof': last_day, 'fetched_at': fetched, 'generated_at': refresh['generated_at'], 'datasets': ['model'],
           'source': 'TRCloud IV3/CN3 (STG/STP/TWP) via MCP, read-only', 'company_ok': company_ok},
          open(os.path.join(OUT, '_snapshot.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open(os.path.join(OUT, 'lines.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['company', 'report', 'item_id', 'document', 'issue_date', 'dept', 'station', 'unit_name', 'business_group', 'sub_unit',
                'include_in_sales', 'channel', 'product_id', 'product_name', 'qty', 'unit_ok', 'amount_ex_vat', 'vat', 'cost', 'status', 'contact_code', 'contact_name'])
    for l in lines:
        u, p, d, k = units[l[2]], products[l[3]], docs[l[4]], contacts[l[10]]
        w.writerow([COMPANIES[l[1]]['code'], d[2], l[12], d[1], (EPOCH + datetime.timedelta(l[0])).isoformat(), u['dept_code'], u['station_name'],
                    u['unit_name'], p['group'], p['sub'], p['include'], CHANNELS[l[14]], p['id'], p['name'], l[5], l[6], l[7], l[13], l[8], statuses[l[9]], k[0], k[1]])
print('lines', len(lines), 'units', len(units), 'products', len(products), 'docs', len(docs), 'dups', dup, 'ok', company_ok)
print('size model.json MB', round(os.path.getsize(os.path.join(OUT, 'model.json')) / 1e6, 2))
