# -*- coding: utf-8 -*-
"""把整站打包成一个自足的 HTML 文件：样式、脚本、数据、插图全部内嵌。
用法：python3 scripts/build_single.py  → 生成 诗成双曜.html（可直接双击打开）
"""
import base64
import mimetypes
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def data_uri(rel):
    path = os.path.join(ROOT, rel)
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    return 'data:%s;base64,%s' % (mime, b64)


html = read('index.html')
css = read('assets/css/style.css')
data_js = read('data/site-data.js')
poems_js = read('data/poems.js')
app_js = read('assets/js/app.js')

# CSS 内的图片引用 → data URI
for m in set(re.findall(r'url\("?\.\./img/([^")]+)"?\)', css)):
    css = css.replace('../img/' + m, data_uri('assets/img/' + m))

# 页面内的 <img src> → data URI
for m in set(re.findall(r'src="assets/img/([^"]+)"', html)):
    html = html.replace('assets/img/' + m, data_uri('assets/img/' + m))

html = html.replace(
    '<link rel="stylesheet" href="assets/css/style.css">',
    '<style>\n' + css + '\n</style>')
html = html.replace(
    '<script src="data/site-data.js"></script>',
    '<script>\n' + data_js + '\n</script>\n<script>\n' + poems_js + '\n</script>')
html = html.replace(
    '<script src="assets/js/app.js"></script>',
    '<script>\n' + app_js + '\n</script>')

out = os.path.join(ROOT, '诗成双曜.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)

print('ok %s %.1f MB' % (out, os.path.getsize(out) / 1024 / 1024))
