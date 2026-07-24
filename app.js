// 单页应用：所有屏幕都在同一个文档里，切屏 = 显示/隐藏 + 上划动画。
// 因为从不发生真正的页面跳转，背景音乐（唯一的 <audio>）永不中断，切屏动画也总会执行。
(function () {
  const bgm = document.getElementById('bgm');
  const screens = Array.from(document.querySelectorAll('.screen'));
  const byName = (name) => document.querySelector('.screen[data-screen="' + name + '"]');
  let switching = false;
  let current = document.querySelector('.screen.is-active') || screens[0];

  /* ---------- 星星魔法棒：点击迸发小星星 + 移动轻量拖尾 ---------- */
  (function wand() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const glyphs = ['✦', '✧', '✩', '⭑', '˖'];
    function burst(x, y, n) {
      for (let i = 0; i < n; i++) {
        const s = document.createElement('div');
        s.className = 'wand-spark';
        s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
        s.style.left = x + 'px'; s.style.top = y + 'px';
        s.style.color = ['#bcd8ff', '#ffffff', '#7fb2ff', '#e6f0ff'][Math.floor(Math.random() * 4)];
        const ang = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 46;
        s.style.setProperty('--wx', Math.cos(ang) * dist + 'px');
        s.style.setProperty('--wy', (Math.sin(ang) * dist - 14) + 'px');
        s.style.setProperty('--wr', (Math.random() * 180 - 90) + 'deg');
        s.style.fontSize = (12 + Math.random() * 10) + 'px';
        document.body.appendChild(s);
        requestAnimationFrame(() => s.classList.add('go'));
        setTimeout(() => s.remove(), 720);
      }
    }
    // 点击迸发
    document.addEventListener('pointerdown', (e) => burst(e.clientX, e.clientY, 6), { passive: true });
    // 移动轻量拖尾（节流，偶尔掉一颗，柔和不糊）
    let last = 0;
    document.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - last < 90) return; last = now;
      if (Math.random() < 0.55) burst(e.clientX + (Math.random() * 8 - 4), e.clientY + (Math.random() * 8 - 4), 1);
    }, { passive: true });
  })();

  /* ---------- 画布等比缩放：对所有 .scaler 生效 ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1440, window.innerHeight / 900);
    document.querySelectorAll('.scaler').forEach(el => el.style.setProperty('--s', s));
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- 首屏 Loading：进度条动画 + 页面资源就绪后淡入整站 ---------- */
  (function loader() {
    window.__loaderStarted = true;
    const loaderEl = document.getElementById('loader');
    const fill = document.getElementById('loaderFill');
    const pctEl = document.getElementById('loaderPct');
    const reveal = () => {
      document.body.classList.remove('is-loading');
      document.body.classList.add('ready');
    };
    if (!loaderEl) { reveal(); startParallax(); return; }

    let pct = 0, finished = false, ready = false;
    const timer = setInterval(() => {
      const cap = ready ? 100 : 90;
      const step = ready ? 6 : Math.max(0.6, (cap - pct) * 0.08);
      pct = Math.min(cap, pct + step);
      const p = Math.round(pct);
      if (fill) fill.style.width = p + '%';
      if (pctEl) pctEl.textContent = p;
      if (ready && pct >= 100) finish();
    }, 60);

    function finish() {
      if (finished) return; finished = true;
      clearInterval(timer);
      setTimeout(() => {
        reveal();
        loaderEl.classList.add('done');
        startParallax();
      }, 240);
    }
    const markReady = () => { ready = true; };
    if (document.readyState === 'complete') markReady();
    else window.addEventListener('load', markReady);
    setTimeout(() => { ready = true; }, 3500);
    setTimeout(finish, 6000);
  })();

  /* ---------- 首页鼠标视差：给 [data-depth] 元素套 .plx 包裹层，只平移包裹层 ---------- */
  // 通用视差：把 stageEl 下所有 [data-depth] 元素套 .plx 包裹层，只平移包裹层
  function buildParallax(stageEl) {
    if (!stageEl || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const items = [];
    stageEl.querySelectorAll('[data-depth]').forEach(node => {
      if (node.closest('.plx')) return;             // 已包裹过，跳过
      const wrap = document.createElement('div');
      wrap.className = 'plx';
      const cs = node.style;
      wrap.style.left = cs.left; wrap.style.top = cs.top;
      wrap.style.width = cs.width; wrap.style.height = cs.height;
      wrap.style.zIndex = cs.zIndex;
      node.style.left = '0'; node.style.top = '0'; node.style.zIndex = '';
      node.parentNode.insertBefore(wrap, node);
      wrap.appendChild(node);
      items.push({ wrap, depth: parseFloat(node.dataset.depth) || 10 });
    });
    if (!items.length) return null;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => {
      raf = 0;
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      items.forEach(({ wrap, depth }) => {
        wrap.style.setProperty('--px', (cx * depth).toFixed(2) + 'px');
        wrap.style.setProperty('--py', (cy * depth).toFixed(2) + 'px');
      });
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(tick);
    };
    const onMove = (e) => {
      tx = -((e.clientX / window.innerWidth) - 0.5);
      ty = -((e.clientY / window.innerHeight) - 0.5);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick); });
    return items;
  }

  let parallaxStarted = false;
  function startParallax() {
    if (parallaxStarted) return; parallaxStarted = true;
    buildParallax(document.querySelector('.screen[data-screen="home"] .stage'));
  }

  /* ---------- About 页进场：卡片依次贴上 → 结束后建视差 ---------- */
  let aboutInited = false;
  function playAbout() {
    const about = byName('about');
    if (!about) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (!aboutInited) { aboutInited = true; buildParallax(about.querySelector('.stage')); }
      return;
    }
    // 每次进入都重放"贴上"动画
    about.classList.remove('about-play', 'about-done');
    void about.offsetWidth;                 // 重置动画
    about.classList.add('about-play');
    // 动画总时长 ≈ 最大 delay(.42) + 时长(.62) ≈ 1.05s，结束后转 done 并建视差
    clearTimeout(about._t);
    about._t = setTimeout(() => {
      about.classList.add('about-done');
      if (!aboutInited) { aboutInited = true; buildParallax(about.querySelector('.stage')); }
    }, 1150);
    setupAboutFun(about);
  }

  /* ---------- About 页趣味动效：狗狗点击彩蛋 ---------- */
  let aboutFunInited = false;
  function setupAboutFun(about) {
    if (aboutFunInited) return;
    aboutFunInited = true;
    const stage = about.querySelector('.stage');

    // 彩蛋：点狗狗 → 抖动 + 冒爱心/爪印
    const pug = about.querySelector('#abPug');
    if (pug) {
      const emojis = ['💙', '🐾', '✨', '💫', '🩵'];
      pug.addEventListener('click', () => {
        pug.classList.remove('wiggle'); void pug.offsetWidth; pug.classList.add('wiggle');
        const px = parseFloat(pug.style.left) + parseFloat(pug.style.width) / 2;
        const py = parseFloat(pug.style.top) + 30;
        for (let i = 0; i < 7; i++) {
          const h = document.createElement('div');
          h.className = 'ab-heart';
          h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
          h.style.left = (px + (Math.random() * 120 - 60)) + 'px';
          h.style.top = py + 'px';
          h.style.setProperty('--hx', (Math.random() * 80 - 40).toFixed(0) + 'px');
          h.style.setProperty('--hy', (-70 - Math.random() * 60).toFixed(0) + 'px');
          h.style.setProperty('--hr', (Math.random() * 60 - 30).toFixed(0) + 'deg');
          stage.appendChild(h);
          requestAnimationFrame(() => h.classList.add('go'));
          setTimeout(() => h.remove(), 1050);
        }
      });
    }
  }

  /* ---------- 切屏：目标屏从底部上划覆盖当前屏 ---------- */
  function go(name) {
    const next = byName(name);
    if (!next || next === current || switching) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    switching = true;

    const prev = current;
    // 目标屏：置于上层、起始在屏幕下方
    next.classList.add('is-incoming');
    next.classList.add('is-active'); // 参与显示
    // 进入可滚动的长图作品页时，回到顶部
    const sc = next.querySelector('.work-scroll, .wc-scroll');
    if (sc) sc.scrollTop = 0;
    // 强制回流后再滑入
    void next.offsetWidth;

    const finish = () => {
      prev.classList.remove('is-active');
      next.classList.remove('is-incoming');
      current = next;
      switching = false;
      syncNav(name);
      updateHash(name);
      if (name === 'about') playAbout();     // 进入 About 播放"贴上"进场
    };

    if (reduce) { next.style.transform = ''; finish(); return; }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => next.classList.add('slide-in'));
    });
    let done = false;
    const onEnd = (e) => {
      if (e.target !== next || e.propertyName !== 'transform') return;
      if (done) return; done = true;
      next.removeEventListener('transitionend', onEnd);
      next.classList.remove('slide-in');
      finish();
    };
    next.addEventListener('transitionend', onEnd);
    setTimeout(() => { if (!done) { done = true; next.classList.remove('slide-in'); finish(); } }, 1000);
  }

  function syncNav(name) {
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-go') === name ||
        (name.startsWith('work-') && a.getAttribute('data-go') === 'productions'));
    });
  }
  function updateHash(name) {
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  }

  /* ---------- 绑定所有带 data-go 的元素 ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go]');
    if (!t) return;
    e.preventDefault();
    go(t.getAttribute('data-go'));
  });

  // 支持带 #hash 直接进入某屏
  const initHash = (location.hash || '').replace('#', '');
  if (initHash && byName(initHash)) {
    current.classList.remove('is-active');
    current = byName(initHash);
    current.classList.add('is-active');
    syncNav(initHash);
    if (initHash === 'about') setTimeout(playAbout, 60);   // 直接进 About 也播放进场
  }

  /* ---------- 首页唱片机交互 + 背景音乐 ---------- */
  const home = byName('home');
  const arm = home.querySelector('.tonearm-btn');
  const cd = home.querySelector('.cd');
  const hint = home.querySelector('.hint');
  let playing = false;

  function toggle() {
    playing = !playing;
    arm.classList.toggle('playing', playing);
    if (cd) cd.classList.toggle('playing', playing);
    if (hint) hint.classList.add('hide');
    home.classList.toggle('bgm-on', playing);   // 播放时 PORTFOLIO 字母跟节奏律动
    if (playing) bgm.play().catch(() => {});
    else bgm.pause();
  }
  if (arm) arm.addEventListener('click', toggle);

  /* ---------- Ending 星星可拖拽 ---------- */
  const endHint = document.querySelector('.hint-end');
  document.querySelectorAll('.star-drag').forEach(star => {
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    const scalerOf = () => star.closest('.scaler');
    const getScale = () => {
      const m = getComputedStyle(scalerOf()).transform;
      if (m && m !== 'none') { const v = m.match(/matrix\(([^)]+)\)/); if (v) return parseFloat(v[1].split(',')[0]) || 1; }
      return 1;
    };
    star.addEventListener('pointerdown', (e) => {
      dragging = true;
      star.classList.add('dragging');
      if (endHint) endHint.classList.add('hide');   // 拖动后隐藏提示
      star.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      ox = parseFloat(star.style.left) || 0;
      oy = parseFloat(star.style.top) || 0;
      e.preventDefault();
    });
    star.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const s = getScale();
      star.style.left = (ox + (e.clientX - sx) / s) + 'px';
      star.style.top = (oy + (e.clientY - sy) / s) + 'px';
    });
    const end = () => { dragging = false; star.classList.remove('dragging'); };
    star.addEventListener('pointerup', end);
    star.addEventListener('pointercancel', end);
  });

  /* ---------- Ending 星座连线小游戏 ---------- */
  (function constellation() {
    const endScreen = byName('ending');
    if (!endScreen) return;
    const svg = endScreen.querySelector('#cnSvg');
    const wish = endScreen.querySelector('#cnWish');
    const stage = endScreen.querySelector('.end-stage');
    const stars = Array.from(endScreen.querySelectorAll('.star-drag'))
      .sort((a, b) => (+a.dataset.cn) - (+b.dataset.cn));
    let nextIdx = 0;          // 下一个应点亮的序号索引(0-based)
    let done = false;

    // 舞台坐标下某颗星星的中心点
    const centerOf = (star) => ({
      x: (parseFloat(star.style.left) || 0) + star.offsetWidth / 2,
      y: (parseFloat(star.style.top) || 0) + star.offsetHeight / 2
    });

    function markNext() {
      stars.forEach((s, i) => s.classList.toggle('cn-next', i === nextIdx && !done));
    }
    // 进入 Ending 时激活“连线模式”视觉（显示序号 + 高亮下一颗）
    function activate() {
      stage.classList.add('cn-active');
      markNext();
    }

    function drawLine(a, b) {
      const p1 = centerOf(a), p2 = centerOf(b);
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', p1.x); ln.setAttribute('y1', p1.y);
      ln.setAttribute('x2', p2.x); ln.setAttribute('y2', p2.y);
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      ln.style.setProperty('--len', len);
      ln.classList.add('draw');
      svg.appendChild(ln);
    }

    function sparkle(star) {
      const c = centerOf(star);
      const stg = star.closest('.stage');
      for (let i = 0; i < 10; i++) {
        const sp = document.createElement('div');
        sp.className = 'cn-spark';
        sp.style.left = c.x + 'px'; sp.style.top = c.y + 'px';
        const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 55;
        sp.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        sp.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
        stg.appendChild(sp);
        requestAnimationFrame(() => sp.classList.add('go'));
        setTimeout(() => sp.remove(), 950);
      }
    }

    function celebrate() {
      done = true;
      stars.forEach(s => s.classList.remove('cn-next'));
      // 闭合回到第 1 颗，连成完整星座
      drawLine(stars[stars.length - 1], stars[0]);
      const th = endScreen.querySelector('.t-thanks');
      if (th) { th.classList.add('cn-celebrate'); setTimeout(() => th.classList.remove('cn-celebrate'), 1600); }
      stars.forEach((s, i) => setTimeout(() => sparkle(s), i * 90));
      if (wish) setTimeout(() => wish.classList.add('show'), 500);
    }

    function litStar(star) {
      star.classList.remove('cn-next');
      star.classList.add('cn-lit');
      sparkle(star);
      // 连线：从上一颗到这一颗
      if (nextIdx > 0) drawLine(stars[nextIdx - 1], star);
      nextIdx++;
      if (nextIdx >= stars.length) celebrate();
      else markNext();
    }

    function wrongStar(star) {
      star.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
         { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 260, easing: 'ease' }
      );
    }

    // 点击判定：区分“点击”和“拖拽”——按下到抬起位移小才算点击
    stars.forEach((star) => {
      let downX = 0, downY = 0, moved = false;
      star.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; moved = false; });
      star.addEventListener('pointermove', (e) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
      });
      star.addEventListener('pointerup', (e) => {
        if (moved || done) return;                 // 拖拽或已完成则不触发连线
        if (star.classList.contains('cn-lit')) return;
        const idx = stars.indexOf(star);
        if (idx === nextIdx) litStar(star);        // 顺序正确
        else wrongStar(star);                      // 顺序错误
      });
    });

    // 首次进入 Ending 屏时激活；用 hash / 点击都会切到该屏
    const armWhenActive = () => { if (endScreen.classList.contains('is-active')) activate(); };
    armWhenActive();
    // 监听切屏（go() 会加 is-active）：用 MutationObserver 侦测
    new MutationObserver(armWhenActive)
      .observe(endScreen, { attributes: true, attributeFilter: ['class'] });
  })();

  /* ---------- Ending 页 Thanks 手写动画：从左往右擦出 + 笔尖跟随 ---------- */
  (function thanksWrite() {
    const box = document.getElementById('tThanks');
    const pathData = window.__THANKS_PATH;
    if (!box || !pathData) return;

    const ns = 'http://www.w3.org/2000/svg';
    const VW = 755, VH = 179, DUR = 1600;   // viewBox 宽高 + 书写时长(ms)，写得利落些
    const uid = 'thMask';

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';

    // 定义遮罩：一个从左往右推移的白色矩形，露出多少字就显示多少
    const defs = document.createElementNS(ns, 'defs');
    const mask = document.createElementNS(ns, 'mask');
    mask.setAttribute('id', uid);
    const maskRect = document.createElementNS(ns, 'rect');
    maskRect.setAttribute('x', '0'); maskRect.setAttribute('y', '-20');
    maskRect.setAttribute('width', '0');            // 初始宽度 0 → 全部隐藏
    maskRect.setAttribute('height', String(VH + 40));
    maskRect.setAttribute('fill', '#fff');
    mask.appendChild(maskRect);
    defs.appendChild(mask);
    svg.appendChild(defs);

    // 实心字（受遮罩控制，从左往右显现）
    const fillPath = document.createElementNS(ns, 'path');
    fillPath.setAttribute('d', pathData);
    fillPath.setAttribute('fill', '#002679');
    fillPath.setAttribute('mask', 'url(#' + uid + ')');
    svg.appendChild(fillPath);

    // 笔尖光点：书写时停在当前"笔尖"位置，写完淡出
    const nib = document.createElementNS(ns, 'circle');
    nib.setAttribute('r', '5');
    nib.setAttribute('fill', '#0a3fb0');
    nib.setAttribute('opacity', '0');
    nib.style.filter = 'drop-shadow(0 0 6px rgba(60,120,255,.9))';
    svg.appendChild(nib);

    box.appendChild(svg);

    let played = false, raf = 0;
    function setProgress(p) {                 // p: 0~1
      const x = p * VW;
      maskRect.setAttribute('width', String(x));
      nib.setAttribute('cx', String(x));
      nib.setAttribute('cy', String(VH * 0.5));
    }
    const end = byName('ending');
    const stage = box.closest('.stage');
    const thanksEl = box;   // .t-thanks 容器

    function popThanks() {
      // Thanks Q 弹
      thanksEl.classList.remove('th-pop'); void thanksEl.offsetWidth; thanksEl.classList.add('th-pop');
      // 迸发星光（沿 Thanks 顶部一线随机散开）
      const bx = parseFloat(box.style.left), by = parseFloat(box.style.top);
      const bw = parseFloat(box.style.width), bh = parseFloat(box.style.height);
      for (let i = 0; i < 14; i++) {
        const sp = document.createElement('div');
        sp.className = 'th-spark';
        sp.style.left = (bx + bw * (0.15 + Math.random() * 0.7)) + 'px';
        sp.style.top = (by + bh * (0.3 + Math.random() * 0.4)) + 'px';
        const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 70;
        sp.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
        sp.style.setProperty('--sy', (Math.sin(ang) * dist - 20) + 'px');
        stage.appendChild(sp);
        requestAnimationFrame(() => sp.classList.add('go'));
        setTimeout(() => sp.remove(), 900);
      }
    }

    function play() {
      if (played) return; played = true;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setProgress(1); stage.classList.add('seq-in', 'seq-done'); return; }
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      nib.setAttribute('opacity', '1');
      let seqFired = false;
      const ease = (t) => 1 - Math.pow(1 - t, 2);   // easeOutQuad，起笔快收笔稳
      const step = (now) => {
        const t = Math.min(1, (now - t0) / DUR);
        setProgress(ease(t));
        // 写到一半就让下方联系方式开始依次浮现（与书写重叠进行）
        if (!seqFired && t >= 0.5) { seqFired = true; stage.classList.add('seq-in'); setTimeout(() => stage.classList.add('seq-done'), 1500); }
        if (t < 1) { raf = requestAnimationFrame(step); }
        else { nib.style.transition = 'opacity .2s ease'; nib.setAttribute('opacity', '0'); popThanks(); }
      };
      raf = requestAnimationFrame(step);
    }
    function reset() {
      played = false; cancelAnimationFrame(raf); setProgress(0);
      nib.style.transition = 'none'; nib.setAttribute('opacity', '0');
      thanksEl.classList.remove('th-pop');
      if (stage) stage.classList.remove('seq-in', 'seq-done');
    }
    reset();

    const check = () => { if (end.classList.contains('is-active')) play(); else reset(); };
    check();
    new MutationObserver(check).observe(end, { attributes: true, attributeFilter: ['class'] });
  })();
})();
