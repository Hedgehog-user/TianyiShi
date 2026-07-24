/* ===== Ending 星星版像素跑酷小游戏 =====
   玩法同 Chrome Dino：许愿星在地面奔跑，点击/空格/↑ 跳跃躲避从右向左移动的陨石。
   撞到 → Game Over，可重开；越跑越快，右上角计分。像素风，蓝紫星空配色。 */
(function () {
  const root = document.getElementById('starRun');
  if (!root) return;
  const canvas = document.getElementById('srCanvas');
  const tip = document.getElementById('srTip');
  const scoreEl = document.getElementById('srScore');
  const overEl = document.getElementById('srOver');
  const winEl = document.getElementById('srWin');
  const ctx = canvas.getContext('2d');

  const W = canvas.width, H = canvas.height;   // 1100 x 300 内部像素坐标
  const GROUND_Y = H - 54;                       // 地平线 y
  const PX = 5;                                  // 像素块大小（像素风颗粒度）

  // ---- 游戏状态 ----
  let state = 'idle';   // idle | running | over
  let raf = 0, lastT = 0;
  let speed = 6, baseSpeed = 6;
  let score = 0, best = 0;
  let obstacles = [];
  let coins = [];
  let hearts = [];   // 可拾取的爱心
  let heartSpawned = false;   // 本局是否已放出过拾取爱心
  let lives = 2;     // 生命(心)数量
  let hurtT = 0;     // 受伤后短暂无敌
  let coinTimer = 0, coinGap = 200;   // 金币生成节奏
  let spawnTimer = 0, spawnGap = 78;
  let groundOffset = 0;
  let graceT = 0;   // 开局无敌帧计时（防止刚开始就被判定撞击）
  const fx = [];    // 飘字特效
  function coinFx(x, y, text, color) { fx.push({ x, y, life: 40, text: text || '+50', color: color || '#bfe4ff' }); }
  const stars = [];   // 背景装饰星
  for (let i = 0; i < 22; i++) stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 30), r: Math.random() < .3 ? 2 : 1 });

  // ---- 主角：许愿星 ----
  const star = {
    x: 120, y: 0, size: 46,
    vy: 0, onGround: true, runFrame: 0
  };
  star.y = GROUND_Y - star.size;
  const GRAVITY = 0.9, JUMP_V = -15;

  // 画一颗像素五角星 + 两只眼睛（马里奥许愿星风格）
  function drawStar(cx, cy, s, frame) {
    // 五角星网格（1 = 亮黄, 2 = 深黄描边, 3 = 眼睛）
    // 用一个 11x11 的位图近似五角星
    const G = [
      '00000100000',
      '00000100000',
      '00001210000',
      '00001210000',
      '11112222111',
      '01122222110',
      '00122232100',
      '00012223100',
      '00122202210',
      '01120000210',
      '01100000110',
    ];
    // 眼睛覆盖：在第 6~7 行中间画两只黑眼
    const cell = s / 11;
    const ox = cx - s / 2, oy = cy - s / 2;
    for (let r = 0; r < G.length; r++) {
      for (let c = 0; c < G[r].length; c++) {
        const v = G[r][c];
        if (v === '0') continue;
        if (v === '1') ctx.fillStyle = '#7fb2ff';
        else if (v === '2') ctx.fillStyle = '#3f6fd0';
        else ctx.fillStyle = '#7fb2ff';
        ctx.fillRect(Math.floor(ox + c * cell), Math.floor(oy + r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    // 两只小眼睛
    ctx.fillStyle = '#2a2140';
    const eyeY = oy + cell * 6;
    ctx.fillRect(Math.floor(ox + cell * 3.6), Math.floor(eyeY), Math.ceil(cell * 1.1), Math.ceil(cell * 1.4));
    ctx.fillRect(Math.floor(ox + cell * 6.3), Math.floor(eyeY), Math.ceil(cell * 1.1), Math.ceil(cell * 1.4));
    // 腮红
    ctx.fillStyle = 'rgba(255,120,140,.55)';
    ctx.fillRect(Math.floor(ox + cell * 2.6), Math.floor(oy + cell * 7.3), Math.ceil(cell), Math.ceil(cell * .8));
    ctx.fillRect(Math.floor(ox + cell * 7.4), Math.floor(oy + cell * 7.3), Math.ceil(cell), Math.ceil(cell * .8));
  }

  // 画像素障碍物：三种形状随机（陨石 / 植物 / 水晶），颜色偏浅灰蓝，与背景区分
  function drawObstacle(m) {
    const s = m.size, ox = m.x, oy = m.y;
    if (m.type === 'bird') return drawBird(m);
    if (m.type === 'plant') return drawPlant(s, ox, oy);
    if (m.type === 'crystal') return drawCrystal(s, ox, oy);
    return drawRock(s, ox, oy);
  }
  function paintGrid(G, cols, rows, s, ox, oy, cMap) {
    const cw = s / cols, ch = s / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = G[r][c]; if (v === '0') continue;
      ctx.fillStyle = cMap[v];
      ctx.fillRect(Math.floor(ox + c * cw), Math.floor(oy + r * ch), Math.ceil(cw), Math.ceil(ch));
    }
  }
  // 陨石（圆钝岩块，中蓝）
  function drawRock(s, ox, oy) {
    const G = ['0011100','0111110','1112111','1121111','1111121','0111110','0011100'];
    paintGrid(G, 7, 7, s, ox, oy, { '1': '#4f7ad0', '2': '#8fb0f0' });
  }
  // 植物（仙人掌/小树，蓝色株 + 顶部亮蓝花）
  function drawPlant(s, ox, oy) {
    const G = ['0010100','0010100','1010101','1010101','1111111','0011100','0011100'];
    paintGrid(G, 7, 7, s, ox, oy, { '1': '#3d6bc4' });
    ctx.fillStyle = '#aee0ff';
    const cw = s / 7;
    ctx.fillRect(Math.floor(ox + cw * 3), Math.floor(oy), Math.ceil(cw), Math.ceil(cw));
  }
  // 珊瑚（分叉枝状，中蓝，替代原水晶）
  function drawCrystal(s, ox, oy) {
    const G = [
      '1010101',
      '1010101',
      '1110111',
      '0111110',
      '0011100',
      '0111110',
      '0111110',
    ];
    paintGrid(G, 7, 7, s, ox, oy, { '1': '#4f86d6', '2': '#7ea8ec' });
  }
  // 小鸟（飞行障碍，翅膀上下扇动，蓝色）
  function drawBird(m) {
    const s = m.size, ox = m.x, oy = m.y;
    // 翅膀两帧：上扬 / 下垂
    const up = Math.floor(performance.now() / 160) % 2 === 0;
    const G = up ? [
      '1000001',
      '1100011',
      '0111110',
      '0011100',
      '0002100',
      '0000000',
      '0000000',
    ] : [
      '0000000',
      '0000000',
      '0011100',
      '0111110',
      '1102011',
      '1100011',
      '1000001',
    ];
    paintGrid(G, 7, 7, s, ox, oy, { '1': '#4f86d6', '2': '#213a66' });
    // 小眼睛
    ctx.fillStyle = '#1a2340';
    const cw = s / 7;
    ctx.fillRect(Math.floor(ox + cw * 3.4), Math.floor(oy + (up ? cw * 3.6 : cw * 4.6)), Math.ceil(cw * .7), Math.ceil(cw * .7));
  }
  // 爱心（可拾取，蓝色像素心）
  function drawHeart(m) {
    const s = m.size, ox = m.x, oy = m.y;
    const G = ['0110110','1111111','1111111','0111110','0011100','0001000','0000000'];
    paintGrid(G, 7, 7, s, ox, oy, { '1': '#4f9dff' });
    // 高光
    ctx.fillStyle = '#cfe8ff';
    const cw = s / 7;
    ctx.fillRect(Math.floor(ox + cw * 1.4), Math.floor(oy + cw * 1.2), Math.ceil(cw * .8), Math.ceil(cw * .8));
  }
  // 左上角生命：画满/空心，返回像素心（用于 HUD）
  function drawHudHeart(x, y, s, filled) {
    const G = ['0110110','1111111','1111111','0111110','0011100','0001000','0000000'];
    const cw = s / 7;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      if (G[r][c] === '0') continue;
      ctx.fillStyle = filled ? '#4f9dff' : 'rgba(120,170,255,.28)';
      ctx.fillRect(Math.floor(x + c * cw), Math.floor(y + r * cw), Math.ceil(cw), Math.ceil(cw));
    }
  }
  // 金币（浅蓝色像素圆币，旋转翻面动画，吃到 +50 里程）
  function drawCoin(m) {
    const s = m.size, cx = m.x + s / 2, cy = m.y + s / 2, cw = s / 7;
    // 旋转相位：用 cos 得到横向缩放(1→0→1)，模拟硬币翻面
    const phase = (performance.now() / 220 + (m.seed || 0)) % (Math.PI * 2);
    const sx = Math.abs(Math.cos(phase));
    if (sx < 0.18) {
      // 接近侧棱：画一条竖细条
      ctx.fillStyle = '#8fd0ff';
      ctx.fillRect(Math.floor(cx - cw * 0.35), Math.floor(m.y), Math.ceil(cw * 0.7), Math.ceil(s));
      return;
    }
    const G = ['0011100','0111110','1122110','1121110','1122110','0111110','0011100'];
    const cmap = { '1': '#bfe4ff', '2': '#8fd0ff' };
    const cwS = cw * sx;
    const ox = cx - (7 * cwS) / 2;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const v = G[r][c]; if (v === '0') continue;
      ctx.fillStyle = cmap[v];
      ctx.fillRect(Math.floor(ox + c * cwS), Math.floor(m.y + r * cw), Math.ceil(cwS) + 1, Math.ceil(cw));
    }
    if (sx > 0.6) {
      ctx.fillStyle = '#eaf6ff';
      ctx.fillRect(Math.floor(ox + 2 * cwS), Math.floor(m.y + cw * 1.5), Math.ceil(cwS * .8), Math.ceil(cw * .8));
    }
  }

  function reset() {
    state = 'idle';
    speed = baseSpeed; score = 0; obstacles = []; coins = []; hearts = []; spawnTimer = 0; spawnGap = 78; coinTimer = 0;
    lives = 2; hurtT = 0; heartSpawned = false;
    star.y = GROUND_Y - star.size; star.vy = 0; star.onGround = true;
    scoreEl.textContent = '0';
    overEl.classList.remove('show');
    if (winEl) winEl.classList.remove('show');
    tip.classList.remove('hide');
    draw();
  }
  function start() {
    if (state === 'running') return;
    state = 'running';
    tip.classList.add('hide');
    overEl.classList.remove('show');
    if (winEl) winEl.classList.remove('show');
    obstacles = []; coins = []; hearts = []; score = 0; speed = baseSpeed;
    lives = 2; hurtT = 0; heartSpawned = false;
    spawnTimer = 0; spawnGap = 120;   // 开局留出缓冲，第一颗陨石晚点来
    coinTimer = 0; coinGap = 160 + Math.random() * 120;
    graceT = 40;                       // 开局约 40 帧无敌，避免瞬间误判
    star.y = GROUND_Y - star.size; star.vy = 0; star.onGround = true;
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function jump() {
    if (state === 'idle') { start(); return; }
    if (state === 'over' || state === 'win') { reset(); start(); return; }
    if (star.onGround) { star.vy = JUMP_V; star.onGround = false; }
  }
  function gameOver() {
    state = 'over';
    best = Math.max(best, Math.floor(score));
    overEl.classList.add('show');
    cancelAnimationFrame(raf);
  }
  function gameWin() {
    state = 'win';
    best = Math.max(best, Math.floor(score));
    if (winEl) winEl.classList.add('show');
    cancelAnimationFrame(raf);
  }

  function spawn() {
    const size = 44 + Math.random() * 26;
    // 天上飞的小鸟 + 地面三种障碍
    const r = Math.random();
    if (r < 0.28) {
      // 小鸟：飞在半空（需保持地面或小跳躲过，或从下钻过）
      const bs = 40 + Math.random() * 16;
      const y = GROUND_Y - bs - 70 - Math.random() * 55;
      obstacles.push({ x: W + 20, y, size: bs, w: bs, h: bs, type: 'bird' });
      return;
    }
    const types = ['rock', 'plant', 'crystal'];
    const type = types[Math.floor(Math.random() * types.length)];
    obstacles.push({ x: W + 20, y: GROUND_Y - size, size, w: size, h: size, type });
  }
  function spawnCoin() {
    const size = 40;
    // 金币悬在半空（跳起才能吃）或贴地，随机
    const high = Math.random() < 0.6;
    const y = high ? GROUND_Y - size - 90 - Math.random() * 40 : GROUND_Y - size - 6;
    coins.push({ x: W + 30, y, size, w: size, h: size, seed: Math.random() * Math.PI * 2 });
  }
  function spawnHeart() {
    const size = 40;
    const y = GROUND_Y - size - 70 - Math.random() * 40;
    hearts.push({ x: W + 40, y, size, w: size, h: size });
    heartSpawned = true;
  }

  function loop(now) {
    const dt = Math.min(2, (now - lastT) / 16.67); lastT = now;
    // 物理
    star.vy += GRAVITY * dt;
    star.y += star.vy * dt;
    if (star.y >= GROUND_Y - star.size) { star.y = GROUND_Y - star.size; star.vy = 0; star.onGround = true; }
    // 障碍
    spawnTimer += dt;
    if (spawnTimer >= spawnGap) { spawnTimer = 0; spawnGap = 62 + Math.random() * 46; spawn(); }
    obstacles.forEach(o => o.x -= speed * dt);
    obstacles = obstacles.filter(o => o.x + o.w > -10);
    // 金币
    coinTimer += dt;
    if (coinTimer >= coinGap) { coinTimer = 0; coinGap = 150 + Math.random() * 140; spawnCoin(); }
    coins.forEach(c => c.x -= speed * dt);
    coins = coins.filter(c => c.x + c.w > -10 && !c.got);
    // 拾取爱心：里程 800~1400 之间放出一颗（未满3心时才放，撞了掉心后能补回）
    if (!heartSpawned && score > 800 && score < 1400) spawnHeart();
    hearts.forEach(h => h.x -= speed * dt);
    hearts = hearts.filter(h => h.x + h.w > -10 && !h.got);
    // 计分 + 加速
    score += 0.35 * dt;
    speed = baseSpeed + score / 90;
    const sbox = { x: star.x + 6, y: star.y + 6, w: star.size - 12, h: star.size - 12 };
    // 吃金币：+50 里程
    for (const c of coins) {
      if (c.got) continue;
      if (sbox.x < c.x + c.w && sbox.x + sbox.w > c.x && sbox.y < c.y + c.h && sbox.y + sbox.h > c.y) {
        c.got = true; score += 50; coinFx(c.x + c.w / 2, c.y + c.h / 2, '+50', '#bfe4ff');
      }
    }
    // 吃爱心：回一颗心（上限 3）
    for (const h of hearts) {
      if (h.got) continue;
      if (sbox.x < h.x + h.w && sbox.x + sbox.w > h.x && sbox.y < h.y + h.h && sbox.y + sbox.h > h.y) {
        h.got = true; if (lives < 3) lives++; coinFx(h.x + h.w / 2, h.y + h.h / 2, '+1♥', '#4f9dff');
      }
    }
    scoreEl.textContent = String(Math.floor(score)).padStart(4, '0');
    // 里程达到 2000 -> 通关成功
    if (score >= 2000) { draw(); gameWin(); return; }
    // 碰撞（缩一圈判定更宽容；开局/受伤无敌帧内不判定）
    if (graceT > 0) graceT -= dt;
    if (hurtT > 0) hurtT -= dt;
    if (graceT <= 0 && hurtT <= 0) {
      const sb = { x: star.x + 8, y: star.y + 8, w: star.size - 16, h: star.size - 16 };
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const ob = { x: o.x + 6, y: o.y + 6, w: o.w - 12, h: o.h - 12 };
        if (sb.x < ob.x + ob.w && sb.x + sb.w > ob.x && sb.y < ob.y + ob.h && sb.y + sb.h > ob.y) {
          lives--;
          obstacles.splice(i, 1);          // 移除撞到的障碍
          coinFx(star.x + star.size / 2, star.y, '-1♥', '#ff6b8a');          if (lives <= 0) { draw(); gameOver(); return; }
          hurtT = 70;                        // 受伤后约70帧无敌+闪烁
          break;
        }
      }
    }
    groundOffset = (groundOffset + speed * dt) % (PX * 6);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 背景装饰星
    ctx.fillStyle = 'rgba(200,220,255,.5)';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2));
    // 地平线（像素虚线）
    ctx.fillStyle = '#9fb0e0';
    ctx.fillRect(0, GROUND_Y, W, 3);
    ctx.fillStyle = 'rgba(159,176,224,.55)';
    for (let x = -PX * 6; x < W; x += PX * 6) ctx.fillRect(x + PX * 6 - groundOffset, GROUND_Y + 10, PX * 3, PX);
    // 障碍
    obstacles.forEach(drawObstacle);
    // 金币
    coins.forEach(c => { if (!c.got) drawCoin(c); });
    // 拾取爱心
    hearts.forEach(h => { if (!h.got) drawHeart(h); });
    // 飘字（金币/爱心/受伤）
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= 1; f.y -= 0.8;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, f.life / 40);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    // 主角（奔跑时上下微跳 1px 模拟跑步；受伤时闪烁）
    const bob = (state === 'running' && star.onGround) ? (Math.floor(performance.now() / 90) % 2 === 0 ? 0 : 3) : 0;
    const blink = hurtT > 0 && Math.floor(performance.now() / 80) % 2 === 0;
    if (!blink) drawStar(star.x + star.size / 2, star.y + star.size / 2 + bob, star.size, 0);
    // 左上角生命心 HUD
    const hs = 26;
    for (let i = 0; i < Math.max(lives, 0); i++) drawHudHeart(14 + i * (hs + 6), 12, hs, true);
    // 空位（最多显示3格容量时不需要，这里只画拥有的心）
  }

  // ---- 交互：只在游戏区域内 / 聚焦时响应，避免抢占页面空格滚动 ----
  root.addEventListener('click', (e) => { e.stopPropagation(); jump(); });
  document.addEventListener('keydown', (e) => {
    // 仅当 Ending 页可见时响应
    const end = document.querySelector('.screen[data-screen="ending"]');
    if (!end || !end.classList.contains('is-active')) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
  });

  // 进入 Ending 时重置到 idle（不自动跑，等玩家点）；离开时停
  const end = document.querySelector('.screen[data-screen="ending"]');
  const sync = () => {
    if (end.classList.contains('is-active')) { if (state !== 'running') reset(); }
    else { cancelAnimationFrame(raf); state = 'idle'; }
  };
  new MutationObserver(sync).observe(end, { attributes: true, attributeFilter: ['class'] });
  reset();
})();
