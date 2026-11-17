# -*- coding: utf-8 -*-
"""把三份 CSV 语料整理成网站所需的 JSON 数据。"""
import csv, json, collections, os, re

RAW = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT = os.path.join(os.path.dirname(__file__), '..', 'data')
PUNC = '，。！？；：、'


def load(f):
    with open(os.path.join(RAW, f), encoding='utf-8-sig') as fh:
        return [r for r in csv.reader(fh) if r]


def core(s):
    return ''.join(c for c in s if c not in PUNC)


lb = load('李白.csv')
df = load('杜甫.csv')
pair = load('李白-杜甫.csv')


def poet_stats(rows, name):
    lines = [r[1] for r in rows]
    chars = core(''.join(lines))
    poems = collections.OrderedDict()
    for r in rows:
        poems.setdefault(r[0], []).append(r[1])
    lens = [len(core(l)) for l in lines]
    cf = collections.Counter(core(chars))
    return {
        'name': name,
        'poems': len(poems),
        'lines': len(lines),
        'chars': len(chars),
        'rawChars': sum(len(l) for l in lines),
        'uniqueChars': len(set(core(chars))),
        'five': sum(1 for l in lens if l == 5),
        'seven': sum(1 for l in lens if l == 7),
        'avgLine': round(sum(lens) / len(lens), 2),
        'avgPoemLines': round(len(lines) / len(poems), 2),
        'charFreq': [[c, n] for c, n in cf.most_common(110)],
        '_poems': poems,
        '_lens': lens,
    }


S_LB = poet_stats(lb, '李白')
S_DF = poet_stats(df, '杜甫')

# ---------- 句长分布 ----------
def len_dist(lens):
    c = collections.Counter(lens)
    order = sorted(c)
    return [[k, c[k]] for k in order if c[k] >= 5]

# ---------- 每首句数分布 ----------
def poem_len_dist(poems):
    c = collections.Counter(len(v) for v in poems.values())
    return [[k, c[k]] for k in sorted(c) if c[k] >= 3][:22]

# ---------- 意象字 per-1000 ----------
IMAGERY = [
    ('月', '月'), ('酒', '酒'), ('剑', '剑'), ('云', '云'), ('山', '山'), ('水', '水'),
    ('江', '江'), ('风', '风'), ('花', '花'), ('雪', '雪'), ('天', '天'), ('秋', '秋'),
    ('春', '春'), ('夜', '夜'), ('舟', '舟'), ('马', '马'), ('鸟', '鸟'), ('雁', '雁'),
    ('松', '松'), ('竹', '竹'), ('海', '海'), ('星', '星'), ('雨', '雨'), ('霜', '霜'),
    ('泪', '泪'), ('老', '老'), ('病', '病'), ('愁', '愁'), ('醉', '醉'), ('梦', '梦'),
    ('客', '客'), ('乡', '乡'),
]
cf_lb = dict((c, n) for c, n in S_LB['charFreq'])
cf_df = dict((c, n) for c, n in S_DF['charFreq'])
full_lb = collections.Counter(core(''.join(r[1] for r in lb)))
full_df = collections.Counter(core(''.join(r[1] for r in df)))
imagery = []
for c, label in IMAGERY:
    a = full_lb[c] / S_LB['chars'] * 1000
    b = full_df[c] / S_DF['chars'] * 1000
    imagery.append({'c': c, 'lb': round(a, 1), 'df': round(b, 1), 'lbN': full_lb[c], 'dfN': full_df[c]})

imagery.sort(key=lambda x: x['lb'] + x['df'], reverse=True)

# ---------- 共享诗语（bi-gram / 短语）排行 ----------
def shared_ngrams(a, b, n):
    ga = [a[i:i + n] for i in range(len(a) - n + 1)]
    gb = set(b[i:i + n] for i in range(len(b) - n + 1))
    return set(g for g in ga if g in gb)

pair_rows = []
for p in pair:
    la, ltd = core(p[2]), core(p[5])
    shared = shared_ngrams(la, ltd, 2)
    if not shared:
        continue
    pair_rows.append({'lbT': p[1], 'lb': p[2], 'dfT': p[4], 'df': p[5],
                      'overlap': len(set(la) & set(ltd)), 'share2': len(shared)})

bg = collections.Counter()
bigram_support = collections.defaultdict(list)
for r in pair_rows:
    s = shared_ngrams(core(r['lb']), core(r['df']), 2)
    for g in s:
        bg[g] += 1
        if len(bigram_support[g]) < 6:
            bigram_support[g].append(r)

# 只保留有实义的词（排除纯虚词/重复字组合）
STOP_BG = {'不不', '人人', '一一', '之之'}
top_bg = [(g, n) for g, n in bg.most_common(140) if g not in STOP_BG and n >= 8][:26]

# ---------- 双星图：挑 6 个共享诗语，各配左右诗句 ----------
star_terms = []
for g, n in top_bg[:60]:
    if len(star_terms) >= 6:
        break
    samples = bigram_support[g]
    # 优先 3 字以上重叠的句对；同一侧的诗句不重复
    best, lbs, dfs = [], set(), set()
    for r in sorted(samples, key=lambda r: -r['overlap']):
        if r['lb'] in lbs or r['df'] in dfs:
            continue
        lbs.add(r['lb']); dfs.add(r['df']); best.append(r)
        if len(best) == 3:
            break
    star_terms.append({'term': g, 'count': n,
                       'pairs': [{'lbT': r['lbT'], 'lb': r['lb'], 'dfT': r['dfT'], 'df': r['df'], 'ov': r['overlap']} for r in best]})

# ---------- 对读卡片：共享 >=3 字，去重 ----------
cards = [r for r in pair_rows if r['overlap'] >= 3]
cards.sort(key=lambda r: (-r['share2'], -r['overlap']))
seen = set()
curated = []
for r in cards:
    key = (r['lb'], r['df'])
    if key in seen:
        continue
    seen.add(key)
    curated.append(r)
curated = curated[:160]

# ---------- 诗句检索库 ----------
def poem_index(s):
    out = []
    for title, lines in s['_poems'].items():
        out.append([title, ''.join(lines)])
    return out

search = {'李白': poem_index(S_LB), '杜甫': poem_index(S_DF)}

meta = {
    'generated': '2026-11',
    'lb': {k: v for k, v in S_LB.items() if not k.startswith('_')},
    'df': {k: v for k, v in S_DF.items() if not k.startswith('_')},
    'lenDist': {'lb': len_dist(S_LB['_lens']), 'df': len_dist(S_DF['_lens'])},
    'poemLen': {'lb': poem_len_dist(S_LB['_poems']), 'df': poem_len_dist(S_DF['_poems'])},
    'imagery': imagery,
    'topBigrams': [{'g': g, 'n': n} for g, n in top_bg],
    'starTerms': star_terms,
    'pairCount': len(pair),
    'pairWith2': len(pair_rows),
    'overlap3': sum(1 for r in pair_rows if r['overlap'] >= 3),
    'overlap4': sum(1 for r in pair_rows if r['overlap'] >= 4),
    'exactSame': sum(1 for p in pair if core(p[2]) == core(p[5])),
    'cards': curated,
}

def write_js(name, var, obj):
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('window.' + var + '=' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';')
    return os.path.getsize(path)


a = write_js('site-data.js', 'SITE_DATA', meta)
b = write_js('poems.js', 'POEMS', search)
print('ok site-data.js=%d poems.js=%d' % (a, b))
print('top bg', top_bg[:10])
print('star', [(t['term'], t['count']) for t in star_terms])
print('exact same', meta['exactSame'], 'cards', len(curated))
