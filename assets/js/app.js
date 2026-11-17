/* ============================================================
   诗成双曜 — 交互与图表
   纯原生 JS，无依赖
   ============================================================ */
(function () {
  'use strict';

  var D = window.SITE_DATA;
  if (!D) { console.warn('SITE_DATA 缺失'); return; }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 观察器：进入视口后执行一次 */
  var onceQueue = new WeakMap();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        var fn = onceQueue.get(e.target);
        if (fn) { fn(); onceQueue.delete(e.target); }
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

  function onView(el, fn) {
    if (!el) return;
    onceQueue.set(el, fn);
    io.observe(el);
  }

  /* 数字滚动 */
  function countUp(el, to, dur, suffix) {
    var start = performance.now();
    var d = dur || 1100;
    function tick(t) {
      var p = Math.min(1, (t - start) / d);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(to * e)) + (suffix || '');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ============================================================
     0. 进度条 & 章节导航
     ============================================================ */
  var progress = $('#progress');
  var navLinks = $$('#juanNav a');
  var sections = $$('section.chapter');

  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var y = window.scrollY || window.pageYOffset;
    if (progress) progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';

    var cur = null;
    sections.forEach(function (s) {
      var top = s.getBoundingClientRect().top;
      if (top < window.innerHeight * 0.42) cur = s.id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + cur);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 初始 reveal 元素
  $$('.reveal').forEach(function (el) { io.observe(el); });

  /* ============================================================
     卷二 量 — 指标格
     ============================================================ */
  var STATS = [
    { label: '诗', a: D.lb.poems, b: D.df.poems, unit: '首', dec: 0 },
    { label: '诗句', a: D.lb.lines, b: D.df.lines, unit: '行', dec: 0 },
    { label: '字（不含标点）', a: D.lb.chars, b: D.df.chars, unit: '字', dec: 0 },
    { label: '独用字', a: D.lb.uniqueChars, b: D.df.uniqueChars, unit: '个', dec: 0 },
    { label: '平均句长', a: D.lb.avgLine, b: D.df.avgLine, unit: '字', dec: 2 },
    { label: '平均篇长', a: D.lb.avgPoemLines, b: D.df.avgPoemLines, unit: '句', dec: 1 }
  ];

  var statGrid = $('#statGrid');
  var statNums = [];
  STATS.forEach(function (s) {
    var el = document.createElement('div');
    el.className = 'stat';
    el.innerHTML =
      '<div class="s-label">' + s.label + '</div>' +
      '<div class="s-line"><em>李</em><span class="s-num n">0</span><span class="s-unit">' + s.unit + '</span></div>' +
      '<div class="s-line df"><em>杜</em><span class="s-num n">0</span><span class="s-unit">' + s.unit + '</span></div>';
    statGrid.appendChild(el);
    statNums.push({
      a: el.querySelectorAll('.n')[0],
      b: el.querySelectorAll('.n')[1],
      va: s.a, vb: s.b, dec: s.dec || 0
    });
  });

  function numTo(v, dec) {
    return dec ? v.toFixed(dec) : fmt(Math.round(v));
  }

  onView(statGrid, function () {
    statNums.forEach(function (o, i) {
      setTimeout(function () {
        runStat(o.a, o.va, o.dec);
        setTimeout(function () { runStat(o.b, o.vb, o.dec); }, 160);
      }, i * 90);
    });
  });

  function runStat(el, to, dec) {
    var t0 = performance.now(), dur = 1150;
    function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      var v = to * e;
      el.textContent = dec ? v.toFixed(dec) : fmt(Math.round(v));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ============================================================
     卷三 字 — 字云
     ============================================================ */
  function buildCloud(sel, freq, footSel) {
    var box = $(sel);
    if (!box) return;

    function seedRand(seed) {
      var s = seed;
      return function () {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    }

    function draw() {
      var W = box.clientWidth || 440;
      var H = window.innerWidth < 620 ? 420 : 400;
      box.style.height = H + 'px';
      box.innerHTML = '';
      var top = freq[0][1];
      var items = freq.slice(0, 62);
      var placed = [];
      var rand = seedRand(W + 37);

      items.forEach(function (f, idx) {
        var c = f[0], n = f[1];
        var ratio = n / top;
        var size = 11 + Math.pow(ratio, .46) * (W < 380 ? 36 : 48);
        var w = size * 1.05, h = size * 1.18;
        var x = null, y = null;

        for (var t = 0; t < 900; t++) {
          var gx = (rand() + rand() + rand()) / 3 - .5;
          var gy = (rand() + rand() + rand()) / 3 - .5;
          var px = W / 2 + gx * (W - w) * 1.74 - w / 2;
          var py = H / 2 + gy * (H - h) * 1.66 - h / 2;
          if (px < 2 || py < 2 || px + w > W - 2 || py + h > H - 2) continue;
          var hit = false;
          for (var j = 0; j < placed.length; j++) {
            var q = placed[j];
            if (px < q.x + q.w + 2 && px + w > q.x - 2 && py < q.y + q.h + 2 && py + h > q.y - 2) { hit = true; break; }
          }
          if (!hit) { x = px; y = py; break; }
        }
        if (x === null) return;
        placed.push({ x: x, y: y, w: w, h: h });

        var span = document.createElement('span');
        span.className = 'zi' + (idx < 3 ? ' z1' : '');
        span.style.fontSize = size.toFixed(1) + 'px';
        span.style.left = x.toFixed(1) + 'px';
        span.style.top = y.toFixed(1) + 'px';
        var rot = (rand() - .5) * (size > 34 ? 5 : 11);
        span.style.setProperty('--rot', rot.toFixed(2) + 'deg');
        span.style.opacity = '0';
        span.innerHTML = esc(c) + '<span class="tip">' + esc(c) + ' · ' + n + ' 次</span>';
        box.appendChild(span);
        (function (sp, op) {
          setTimeout(function () { sp.style.opacity = String(op); }, idx * 22);
        })(span, 0.45 + Math.pow(ratio, .35) * 0.55);
      });
    }

    draw();
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(draw, 280);
    });

    var foot = $(footSel);
    if (foot) foot.textContent = '最常见：' + freq[0][0] + '（' + fmt(freq[0][1]) + ' 次）';
  }
  buildCloud('#cloudLb', D.lb.charFreq, '#lbTop');
  buildCloud('#cloudDf', D.df.charFreq, '#dfTop');

  /* ============================================================
     卷四 象 — 意象对照
     ============================================================ */
  var imageryList = $('#imageryList');
  if (imageryList) {
    var maxAll = 0;
    D.imagery.forEach(function (o) { maxAll = Math.max(maxAll, o.lb, o.df); });
    var sorted = D.imagery.slice().sort(function (a, b) {
      return Math.max(b.lb, b.df) - Math.max(a.lb, a.df);
    });

    var cols = [document.createElement('div'), document.createElement('div')];
    cols.forEach(function (c) { c.className = 'imagery-col'; imageryList.appendChild(c); });

    var rows = [];
    sorted.forEach(function (o, i) {
      var col = cols[i % 2 === 0 ? 0 : 1];
      var row = document.createElement('div');
      row.className = 'imagery-row';
      var hot = Math.abs(o.lb - o.df) >= 2;
      row.innerHTML =
        '<div class="zi' + (hot ? ' hot' : '') + '">' + esc(o.c) + '</div>' +
        '<div class="bar-side left"><span class="val">' + o.lb.toFixed(1) + '</span>' +
        '<span class="track"><i class="fill" data-w="' + (o.lb / maxAll * 100).toFixed(1) + '"></i></span></div>' +
        '<div class="bar-side right">' +
        '<span class="track"><i class="fill" data-w="' + (o.df / maxAll * 100).toFixed(1) + '"></i></span>' +
        '<span class="val">' + o.df.toFixed(1) + '</span></div>';
      col.appendChild(row);
      rows.push(row);
    });

    onView(imageryList, function () {
      rows.forEach(function (row, i) {
        var f = $$('.fill', row);
        setTimeout(function () {
          f.forEach(function (x) { x.style.width = x.dataset.w + '%'; });
        }, i * 26);
      });
    });
  }

  /* ============================================================
     卷五 律 — 句长与篇幅
     ============================================================ */
  function buildSlips(card, poet) {
    var p = D[poet];
    var total = p.lines;
    var parts = [
      { k: '五言', n: p.five, cls: poet },
      { k: '七言', n: p.seven, cls: 'dim' },
      { k: '其他', n: total - p.five - p.seven, cls: 'dim' }
    ];
    var wrap = $('.slips', card);
    var bars = [];
    parts.forEach(function (x) {
      var pct = x.n / total * 100;
      var slip = document.createElement('div');
      slip.className = 'slip';
      slip.innerHTML = '<span class="pct">' + pct.toFixed(1) + '%</span>' +
        '<div class="bar ' + x.cls + '" data-h="' + pct.toFixed(1) + '"></div>' +
        '<span class="cap">' + x.k + '</span>';
      wrap.appendChild(slip);
      bars.push($('.bar', slip));
    });
    return bars;
  }

  var meterBars = [];
  $$('.meter-card[data-poet]').forEach(function (card) {
    var poet = card.dataset.poet;
    meterBars = meterBars.concat(buildSlips(card, poet));
    onView(card, function () {
      card.classList.add('visible');
      $$('.bar', card).forEach(function (b, i) {
        setTimeout(function () { b.style.height = b.dataset.h + '%'; }, i * 110);
      });
    });
  });

  var spreadRows = $('#spreadRows');
  if (spreadRows && D.poemLen) {
    var BINS = [4, 8, 12, 16, 20, 24, 999];
    var LBL = ['4 句', '8 句', '12 句', '16 句', '20 句', '24 句', '其他'];
    function binOf(k) {
      for (var i = 0; i < BINS.length; i++) { if (k === BINS[i]) return i; }
      return BINS.length - 1;   // 其餘句數歸入「其他」
    }
    var agg = { lb: new Array(BINS.length).fill(0), df: new Array(BINS.length).fill(0) };
    ['lb', 'df'].forEach(function (who) {
      D.poemLen[who].forEach(function (d) { agg[who][binOf(d[0])] += d[1]; });
    });
    var maxV = 0;
    for (var i = 0; i < BINS.length; i++) maxV = Math.max(maxV, agg.lb[i], agg.df[i]);

    var lines = [];
    LBL.forEach(function (lbl, i) {
      var a = agg.lb[i], b = agg.df[i];
      if (!a && !b) return;
      var row = document.createElement('div');
      row.className = 'spread-row';
      row.innerHTML =
        '<span class="k">' + lbl + '</span>' +
        '<div class="pair">' +
        '  <div class="ln lb" data-w="' + (a / maxV * 100) + '"></div>' +
        '  <div class="ln df" data-w="' + (b / maxV * 100) + '"></div>' +
        '</div>' +
        '<span class="n">' + (a ? fmt(a) : '—') + ' / ' + (b ? fmt(b) : '—') + '</span>';
      spreadRows.appendChild(row);
      lines.push(row);
    });

    onView(spreadRows, function () {
      lines.forEach(function (row, i) {
        setTimeout(function () {
          $$('.ln', row).forEach(function (x) { x.style.width = x.dataset.w + '%'; });
        }, i * 60);
      });
    });
  }

  /* ============================================================
     卷六 逢 — 共享诗语榜
     ============================================================ */
  var termList = $('#termList');
  if (termList && D.topBigrams) {
    var maxN = D.topBigrams[0].n;
    var bars = [];
    D.topBigrams.slice(0, 13).forEach(function (b, i) {
      var row = document.createElement('div');
      row.className = 'term-row';
      row.innerHTML =
        '<span class="t">' + esc(b.g) + '</span>' +
        '<div class="track"><div class="bar" data-w="' + (b.n / maxN * 100).toFixed(1) + '"></div></div>' +
        '<span class="n">' + b.n + '</span>';
      termList.appendChild(row);
      bars.push(row);
    });
    onView(termList, function () {
      bars.forEach(function (row, i) {
        setTimeout(function () {
          $('.bar', row).style.width = $('.bar', row).dataset.w + '%';
        }, i * 55);
      });
    });
  }

  /* ============================================================
     卷六 — 双星图
     ============================================================ */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var starSvg = $('#starSvg');
  var starTabs = $('#starTabs');
  var starDetail = $('#starDetail');
  var starTerms = D.starTerms || [];

  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) { n.setAttribute(k, attrs[k]); }
    if (parent) parent.appendChild(n);
    return n;
  }

  function renderStar(idx, animate) {
    var term = starTerms[idx];
    if (!term || !starSvg) return;
    while (starSvg.firstChild) starSvg.removeChild(starSvg.firstChild);

    var W = 560, cx = 280, lx = 206, rx = 354;
    var pairs = (term.pairs || []).slice(0, 3);
    var H = pairs.length <= 1 ? 200 : (pairs.length === 2 ? 300 : 420);
    var cy = H / 2;
    var ys = pairs.length === 1 ? [cy] : (pairs.length === 2 ? [cy - 74, cy + 74] : [cy - 114, cy, cy + 114]);
    starSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var gl = el('g', { class: 'star-links' }, starSvg);

    // 边角标签
    var lbTag = el('text', {
      x: 16, y: 26, 'font-size': 11, fill: '#5c766d', 'letter-spacing': 4
    }, starSvg);
    lbTag.textContent = '李 白';
    var dfTag = el('text', {
      x: W - 16, y: 26, 'font-size': 11, fill: '#9b2f26', 'letter-spacing': 4,
      'text-anchor': 'end'
    }, starSvg);
    dfTag.textContent = '杜 甫';

    // 中央印
    var g0 = el('g', { class: 'star-node star-center' }, starSvg);
    el('rect', {
      x: cx - 44, y: cy - 44, width: 88, height: 88, rx: 3,
      fill: '#9b2f26'
    }, g0);
    el('rect', {
      x: cx - 38, y: cy - 38, width: 76, height: 76, rx: 2,
      fill: 'none', stroke: '#fff4e8', 'stroke-width': .9, opacity: '.45'
    }, g0);
    var ct = el('text', {
      x: cx, y: cy + 9, 'text-anchor': 'middle', 'font-size': 25,
      fill: '#fff6ea', 'letter-spacing': 3
    }, g0);
    ct.textContent = term.term;

    var cnt = el('text', {
      x: cx, y: cy + 70, 'text-anchor': 'middle', 'font-size': 10,
      fill: '#857a6d', 'letter-spacing': 3
    }, g0);
    cnt.textContent = term.count + ' 组句对';

    pairs.forEach(function (p, i) {
      var y = ys[i];

      el('path', {
        d: 'M ' + (cx - 44) + ' ' + cy + ' Q ' + (lx + (cx - 44 - lx) / 2) + ' ' +
          (cy + (y - cy) * .55) + ', ' + lx + ' ' + y,
        fill: 'none', stroke: '#bdb0a0', 'stroke-width': 1
      }, gl);
      el('path', {
        d: 'M ' + (cx + 44) + ' ' + cy + ' Q ' + (rx + (cx + 44 - rx) / 2) + ' ' +
          (cy + (y - cy) * .55) + ', ' + rx + ' ' + y,
        fill: 'none', stroke: '#bdb0a0', 'stroke-width': 1
      }, gl);

      var gl1 = el('g', { class: 'star-node', 'data-side': 'lb', 'data-i': i }, starSvg);
      el('circle', { cx: lx, cy: y, r: 3.2, fill: '#5c766d' }, gl1);
      var t1 = el('text', {
        x: lx - 12, y: y + 5, 'text-anchor': 'end', 'font-size': 15.5,
        fill: '#1a1714', 'letter-spacing': .5
      }, gl1);
      t1.textContent = p.lb;

      var gl2 = el('g', { class: 'star-node', 'data-side': 'df', 'data-i': i }, starSvg);
      el('circle', { cx: rx, cy: y, r: 3.2, fill: '#9b2f26' }, gl2);
      var t2 = el('text', {
        x: rx + 12, y: y + 5, 'text-anchor': 'start', 'font-size': 15.5,
        fill: '#1a1714', 'letter-spacing': .5
      }, gl2);
      t2.textContent = p.df;

      [gl1, gl2].forEach(function (g) {
        g.addEventListener('click', function () {
          showDetail(term, p, g.dataset.side);
          $$('.star-node', starSvg).forEach(function (n) { n.classList.remove('sel'); });
          g.classList.add('sel');
          $$('.star-links path', starSvg).forEach(function (l) { l.style.stroke = '#bdb0a0'; });
        });
        g.addEventListener('mouseenter', function () { g.style.opacity = '.85'; });
        g.addEventListener('mouseleave', function () { g.style.opacity = '1'; });
      });
    });

    if (animate) {
      starSvg.style.opacity = '0';
      requestAnimationFrame(function () {
        starSvg.style.transition = 'opacity .55s';
        starSvg.style.opacity = '1';
      });
    }
  }

  function showDetail(term, p, side) {
    if (!starDetail) return;
    var other = side === 'lb' ? { who: '杜甫', t: p.dfT, v: p.df, cls: 'b' }
      : { who: '李白', t: p.lbT, v: p.lb, cls: 'a' };
    var self = side === 'lb' ? { who: '李白', t: p.lbT, v: p.lb, cls: 'a' }
      : { who: '杜甫', t: p.dfT, v: p.df, cls: 'b' };
    starDetail.innerHTML =
      '<div class="term">「' + esc(term.term) + '」</div>' +
      '<div style="font-size:12.5px;color:#857a6d;letter-spacing:.1em;margin-bottom:10px">' +
      '两句共用「' + esc(term.term) + '」，共 ' + term.count + ' 组句对支持</div>' +
      '<div class="pl">' +
      '  <span><b class="lbt" style="color:#5c766d">' + self.who + ' · ' + esc(self.t) + '</b>' + esc(self.v) + '</span>' +
      '  <span><b class="dft" style="color:#9b2f26">' + other.who + ' · ' + esc(other.t) + '</b>' + esc(other.v) + '</span>' +
      '</div>';
  }

  if (starTabs && starTerms.length) {
    starTerms.forEach(function (t, i) {
      var btn = document.createElement('button');
      btn.className = 'chip' + (i === 0 ? ' on' : '');
      btn.textContent = t.term;
      btn.addEventListener('click', function () {
        $$('.chip', starTabs).forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        renderStar(i, true);
        showDetail(t, t.pairs[0], 'lb');
      });
      starTabs.appendChild(btn);
    });
    renderStar(0, false);
    showDetail(starTerms[0], starTerms[0].pairs[0], 'lb');
  }

  /* ============================================================
     卷七 对读 — 卡片
     ============================================================ */
  var CARD_N = 12;
  var pairGrid = $('#pairGrid');
  var cardCount = $('#cardCount');

  function highlight(line, shared) {
    var out = '';
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (shared.indexOf(c) >= 0) out += '<em>' + esc(c) + '</em>';
      else out += esc(c);
    }
    return out;
  }

  function renderCards() {
    if (!pairGrid) return;
    var pool = D.cards || [];
    var start = Math.floor(Math.random() * Math.max(1, pool.length - CARD_N * 2));
    var pick = [], usedLb = {}, usedDf = {};
    for (var k = 0; k < pool.length && pick.length < CARD_N; k++) {
      var cand = pool[(start + k) % pool.length];
      if (usedLb[cand.lb] || usedDf[cand.df]) continue;
      usedLb[cand.lb] = 1; usedDf[cand.df] = 1;
      pick.push(cand);
    }
    pairGrid.innerHTML = '';
    pick.forEach(function (p, i) {
      var shared = [];
      Array.prototype.forEach.call(p.lb.replace(/[，。！？；：、]/g, ''), function (c) {
        if (p.df.indexOf(c) >= 0 && shared.indexOf(c) < 0) shared.push(c);
      });
      var card = document.createElement('div');
      card.className = 'pair-card paper-card';
      card.innerHTML =
        '<div class="side a"><div class="who">李 白 · ' + esc(p.lbT) + '</div>' +
        '<div class="verse">' + highlight(p.lb, shared) + '</div></div>' +
        '<div class="side b"><div class="who">杜 甫 · ' + esc(p.dfT) + '</div>' +
        '<div class="verse">' + highlight(p.df, shared) + '</div></div>' +
        '<div class="badge">共用 ' + shared.length + ' 字' + (shared.length ? ' · ' + shared.join('、') : '') + '</div>';
      card.style.opacity = '0';
      card.style.transform = 'translateY(14px)';
      card.style.transition = 'opacity .6s ' + (i * 0.05).toFixed(2) + 's, transform .6s ' + (i * 0.05).toFixed(2) + 's';
      pairGrid.appendChild(card);
      requestAnimationFrame(function () {
        card.style.opacity = '1';
        card.style.transform = 'none';
      });
    });
    if (cardCount) cardCount.textContent = pick.length;
  }
  renderCards();
  var shuffleBtn = $('#shuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', renderCards);

  /* ============================================================
     卷八 检 — 检索
     ============================================================ */
  var qInput = $('#q');
  var results = $('#results');
  var filters = $('#searchFilters');
  var poems = null, loading = false, whoFilter = 'all', lastQ = '';

  function loadPoems(cb) {
    if (window.POEMS) { poems = window.POEMS; cb(); return; }
    if (loading) return;
    loading = true;
    results.innerHTML = '<div class="search-empty">正在载入诗库……</div>';
    var s = document.createElement('script');
    s.src = 'data/poems.js';
    s.onload = function () { poems = window.POEMS; loading = false; cb(); };
    s.onerror = function () {
      loading = false;
      results.innerHTML = '<div class="search-empty">诗库载入失败——请透过 HTTP 服务开启本页（如 python3 -m http.server）。</div>';
    };
    document.body.appendChild(s);
  }

  function doSearch() {
    if (!qInput || !results) return;
    var q = qInput.value.trim();
    lastQ = q;
    if (!q) { results.innerHTML = '<div class="search-empty">输入字词，开始检索</div>'; return; }
    if (!poems) { loadPoems(doSearch); return; }

    var hits = [];
    ['李白', '杜甫'].forEach(function (who) {
      if (whoFilter !== 'all' && whoFilter !== who) return;
      (poems[who] || []).forEach(function (p) {
        if (p[1].indexOf(q) >= 0) hits.push({ who: who, title: p[0], text: p[1] });
      });
    });

    var total = hits.length;
    var shown = hits.slice(0, 36);
    if (!total) {
      results.innerHTML = '<div class="search-empty">「' + esc(q) + '」未见于两家诗中</div>';
      return;
    }
    var html = '<div style="font-size:12px;letter-spacing:.16em;color:#857a6d;margin-bottom:8px">' +
      '「' + esc(q) + '」共见于 <b style="color:#9b2f26">' + fmt(total) + '</b> 首诗' +
      (total > shown.length ? '，显示前 ' + shown.length + ' 首' : '') + '</div>';
    shown.forEach(function (h) {
      var marked = esc(h.text).split(esc(q)).join('<em>' + esc(q) + '</em>');
      html += '<div class="result-row">' +
        '<div class="rt"><span class="who" style="display:block;color:' + (h.who === '李白' ? '#5c766d' : '#9b2f26') + '">' + h.who + '</span>' + esc(h.title) + '</div>' +
        '<div class="rv">' + marked + '</div>' +
        '</div>';
    });
    results.innerHTML = html;
  }

  if (qInput) {
    var timer = null;
    qInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(doSearch, 380);
    });
    qInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { clearTimeout(timer); doSearch(); }
    });
    qInput.addEventListener('focus', function () { loadPoems(function () { }); });
  }
  if (filters) {
    $$('.chip', filters).forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.chip', filters).forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        whoFilter = btn.dataset.who;
        if (lastQ) doSearch();
      });
    });
  }

  /* ============================================================
     锚点平滑滚动（考虑固定导航）
     ============================================================ */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

})();
