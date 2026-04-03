// ══════════════════════════════════════════════════════════════════════════════
// LOBBY
// ══════════════════════════════════════════════════════════════════════════════
function initLobby() {
  // Animated stats
  animateStat('stat-total-bets', 482193);
  animateStat('stat-total-won', 1284750.42, true);
  animateStat('stat-players', 3241);
  animateStat('stat-jackpot', 50000, true);
}

function animateStat(id, target, money = false) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = target / 60;
  const t = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = money ? '$' + current.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})
                           : Math.floor(current).toLocaleString();
    if (current >= target) clearInterval(t);
  }, 16);
}

// ══════════════════════════════════════════════════════════════════════════════
// DICE
// ══════════════════════════════════════════════════════════════════════════════
let diceState = { rolling: false, history: [] };

function initDice() {
  updateDiceStats();
  const slider = document.getElementById('dice-slider');
  if (slider) slider.addEventListener('input', updateDiceStats);
}

function updateDiceStats() {
  const slider = document.getElementById('dice-slider');
  const chance = parseFloat(slider?.value || 50);
  const mult   = Math.min(20, 99 / chance);
  document.getElementById('dice-chance').textContent  = chance.toFixed(1) + '%';
  document.getElementById('dice-mult').textContent    = mult.toFixed(4) + '×';
  document.getElementById('dice-edge').textContent    = '1.00%';

  // Update slider fill
  if (slider) {
    const pct = ((chance - 1) / 94) * 100;
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg5) ${pct}%, var(--bg5) 100%)`;
  }
}

async function rollDice() {
  if (diceState.rolling) return;
  if (!requireAuth()) return;

  const betEl  = document.getElementById('dice-bet');
  const bet    = parseFloat(betEl?.value || 0);
  const slider = document.getElementById('dice-slider');
  const chance = parseFloat(slider?.value || 50);
  const mult   = Math.min(20, 99 / chance);

  if (!validateBet(bet)) return;

  diceState.rolling = true;
  const btn = document.getElementById('dice-btn');
  btn.disabled = true;
  btn.textContent = 'Rolling…';

  // Animate roll
  const resultEl = document.getElementById('dice-result');
  resultEl.className = 'dice-result-big';
  const tick = setInterval(() => {
    resultEl.textContent = (Math.random() * 100).toFixed(2);
  }, 60);

  await sleep(1400);
  clearInterval(tick);

  const roll = +(Math.random() * 100).toFixed(2);
  const win  = roll < chance;
  const pnl  = win ? +(bet * (mult - 1)).toFixed(2) : -bet;

  resultEl.textContent = roll.toFixed(2);
  resultEl.className   = 'dice-result-big ' + (win ? 'win' : 'loss');

  showResultBadge('dice-result-overlay', win, pnl);

  await updateBalance(pnl, 'Dice', bet, win ? mult : 0);
  showToast(win ? `🎲 Win! +$${pnl.toFixed(2)}` : `🎲 Loss -$${bet.toFixed(2)}`, win ? 'win' : 'loss');

  // History chip
  const hist = document.getElementById('dice-history');
  const chip = document.createElement('span');
  chip.className = `hist-chip ${win ? 'win' : 'loss'}`;
  chip.textContent = roll.toFixed(2);
  hist.prepend(chip);
  if (hist.children.length > 15) hist.lastChild.remove();

  diceState.rolling = false;
  btn.disabled = false;
  btn.textContent = 'Roll Dice';
}

// ══════════════════════════════════════════════════════════════════════════════
// CRASH
// ══════════════════════════════════════════════════════════════════════════════
let crashState = {
  phase: 'idle', // idle | betting | flying | crashed
  mult: 1.00,
  cashedOut: false,
  betAmt: 0,
  timer: null,
  animFrame: null,
  points: [],
  startTs: null
};

function initCrash() {
  drawCrashIdle();
}

function drawCrashIdle() {
  const canvas = document.getElementById('crash-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  resizeCrashCanvas(canvas);
  drawCrashBg(ctx, canvas, []);
  const m = document.getElementById('crash-mult-display');
  if (m) { m.textContent = '1.00×'; m.className = 'crash-multiplier'; }
  const sm = document.getElementById('crash-small-text');
  if (sm) sm.textContent = 'Place your bet';
}

function resizeCrashCanvas(canvas) {
  canvas.width  = canvas.offsetWidth  || 620;
  canvas.height = canvas.offsetHeight || 360;
}

function drawCrashBg(ctx, canvas, points) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,.04)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(0, H * i/5); ctx.lineTo(W, H * i/5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * i/5, 0); ctx.lineTo(W * i/5, H); ctx.stroke();
  }

  if (points.length < 2) return;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(0,231,1,.25)');
  grad.addColorStop(1, 'rgba(0,231,1,.02)');
  ctx.beginPath();
  ctx.moveTo(points[0].x, H);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length-1].x, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#00e701';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Glow dot at tip
  const tip = points[points.length-1];
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 6, 0, Math.PI*2);
  ctx.fillStyle = '#00e701';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 12, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,231,1,.25)';
  ctx.fill();
}

async function startCrash() {
  if (crashState.phase !== 'idle') return;
  if (!requireAuth()) return;

  const betEl = document.getElementById('crash-bet');
  const bet   = parseFloat(betEl?.value || 0);
  if (!validateBet(bet)) return;

  crashState.betAmt    = bet;
  crashState.cashedOut = false;
  crashState.phase     = 'betting';
  crashState.mult      = 1.00;
  crashState.points    = [];

  const btn    = document.getElementById('crash-btn');
  const multEl = document.getElementById('crash-mult-display');
  const sm     = document.getElementById('crash-small-text');
  btn.textContent = 'Cash Out';
  btn.className   = 'bet-btn';
  btn.style.background = '#f5a623';
  btn.onclick     = cashOutCrash;

  if (sm) sm.textContent = `Bet: $${bet.toFixed(2)}`;

  await sleep(800);

  // Determine crash point: floor(97/u)/100 formula
  const u      = Math.random();
  const target = Math.max(1.01, Math.floor(97 / u) / 100);
  crashState.phase   = 'flying';
  crashState.startTs = performance.now();

  const canvas = document.getElementById('crash-canvas');
  const ctx    = canvas?.getContext('2d');

  function frame(ts) {
    if (crashState.phase !== 'flying') return;
    const elapsed = (ts - crashState.startTs) / 1000;
    crashState.mult = Math.pow(Math.E, 0.15 * elapsed);

    if (crashState.mult >= target) {
      crashState.mult = target;
      doCrash(target, bet, ctx, canvas);
      return;
    }

    if (multEl) { multEl.textContent = crashState.mult.toFixed(2) + '×'; }

    // Draw
    if (canvas && ctx) {
      resizeCrashCanvas(canvas);
      const W = canvas.width, H = canvas.height;
      const maxTime = 8;
      const px = Math.min(elapsed / maxTime, 1) * (W - 60) + 40;
      const py = H - 40 - (Math.pow(Math.E, 0.15 * elapsed) - 1) / (target - 1) * (H - 80);
      crashState.points.push({ x: px, y: Math.max(40, py) });
      drawCrashBg(ctx, canvas, crashState.points);
    }

    crashState.animFrame = requestAnimationFrame(frame);
  }

  crashState.animFrame = requestAnimationFrame(frame);
}

function cashOutCrash() {
  if (crashState.phase !== 'flying' || crashState.cashedOut) return;
  crashState.cashedOut = true;
  const mult = crashState.mult;
  const bet  = crashState.betAmt;
  const pnl  = +(bet * (mult - 1)).toFixed(2);
  crashState.phase = 'idle';
  cancelAnimationFrame(crashState.animFrame);

  updateBalance(pnl, 'Crash', bet, mult);
  showToast(`💸 Cashed out at ${mult.toFixed(2)}× +$${pnl.toFixed(2)}`, 'win');
  resetCrashBtn();
  addCrashHistChip(mult.toFixed(2), false);
}

function doCrash(mult, bet, ctx, canvas) {
  crashState.phase = 'crashed';
  cancelAnimationFrame(crashState.animFrame);

  const multEl = document.getElementById('crash-mult-display');
  const sm     = document.getElementById('crash-small-text');
  if (multEl) { multEl.textContent = mult.toFixed(2) + '×'; multEl.className = 'crash-multiplier crashed'; }
  if (sm) sm.textContent = 'CRASHED!';

  if (!crashState.cashedOut) {
    updateBalance(-bet, 'Crash', bet, mult);
    showToast(`💥 Crashed at ${mult.toFixed(2)}× -$${bet.toFixed(2)}`, 'loss');
  }

  addCrashHistChip(mult.toFixed(2), true);

  setTimeout(() => {
    crashState.phase = 'idle';
    crashState.points = [];
    resetCrashBtn();
    drawCrashIdle();
    if (multEl) multEl.className = 'crash-multiplier';
    if (sm) sm.textContent = 'Place your bet';
  }, 2500);
}

function resetCrashBtn() {
  const btn = document.getElementById('crash-btn');
  if (btn) {
    btn.textContent = 'Start Game';
    btn.style.background = '';
    btn.className = 'bet-btn green';
    btn.onclick = startCrash;
  }
}

function addCrashHistChip(val, crashed) {
  const hist = document.getElementById('crash-history');
  if (!hist) return;
  const chip = document.createElement('span');
  const v = parseFloat(val);
  chip.className = `hist-chip ${v < 2 ? 'loss' : v < 10 ? 'neutral' : 'win'}`;
  chip.textContent = val + '×';
  hist.prepend(chip);
  if (hist.children.length > 15) hist.lastChild.remove();
}

// ══════════════════════════════════════════════════════════════════════════════
// MINES
// ══════════════════════════════════════════════════════════════════════════════
let minesState = {
  active: false,
  board: [],   // 'gem' | 'mine'
  revealed: [],
  mineCount: 3,
  gemsFound: 0,
  betAmt: 0
};

const MINES_SIZE = 25;

function initMines() {
  renderMinesGrid();
}

function getMinesMult(gemsFound, mines) {
  // Simplified: each gem multiplies by safe/(safe-found)
  let m = 1;
  const safe = MINES_SIZE - mines;
  for (let i = 0; i < gemsFound; i++) {
    m *= (MINES_SIZE - mines - i) / (MINES_SIZE - i) * (MINES_SIZE / (MINES_SIZE - mines));
  }
  return Math.max(1, +(m * 0.98).toFixed(4));
}

function startMines() {
  if (!requireAuth()) return;
  const bet   = parseFloat(document.getElementById('mines-bet')?.value || 0);
  const mines = parseInt(document.getElementById('mines-count')?.value  || 3);
  if (!validateBet(bet)) return;

  minesState.active    = true;
  minesState.betAmt    = bet;
  minesState.mineCount = mines;
  minesState.gemsFound = 0;
  minesState.revealed  = new Array(MINES_SIZE).fill(false);

  // Randomly place mines
  const positions = shuffle([...Array(MINES_SIZE).keys()]);
  minesState.board = new Array(MINES_SIZE).fill('gem');
  positions.slice(0, mines).forEach(i => minesState.board[i] = 'mine');

  renderMinesGrid();
  updateMinesDisplay();

  document.getElementById('mines-start-btn').style.display = 'none';
  document.getElementById('mines-cashout-btn').style.display = 'block';
}

function renderMinesGrid() {
  const grid = document.getElementById('mines-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < MINES_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'mine-cell';
    cell.dataset.idx = i;

    if (minesState.active && minesState.revealed[i]) {
      cell.classList.add('revealed');
      if (minesState.board[i] === 'gem') {
        cell.textContent = '💎'; cell.classList.add('safe');
      } else {
        cell.textContent = '💣'; cell.classList.add('mine-boom');
      }
    } else {
      cell.textContent = '';
      if (minesState.active) {
        cell.addEventListener('click', () => clickMineCell(i));
      } else {
        cell.classList.add('disabled');
      }
    }
    grid.appendChild(cell);
  }
}

function clickMineCell(idx) {
  if (!minesState.active || minesState.revealed[idx]) return;
  minesState.revealed[idx] = true;

  if (minesState.board[idx] === 'mine') {
    // Reveal all
    minesState.revealed = minesState.revealed.map(() => true);
    renderMinesGrid();
    const bet = minesState.betAmt;
    minesState.active = false;
    updateBalance(-bet, 'Mines', bet, 0);
    showToast(`💣 Mine hit! -$${bet.toFixed(2)}`, 'loss');
    document.getElementById('mines-start-btn').style.display = 'block';
    document.getElementById('mines-cashout-btn').style.display = 'none';
    document.getElementById('mines-mult').textContent = '0.00×';
  } else {
    minesState.gemsFound++;
    renderMinesGrid();
    updateMinesDisplay();
    showToast(`💎 Safe! Keep going…`, 'info');
  }
}

function updateMinesDisplay() {
  const m = getMinesMult(minesState.gemsFound, minesState.mineCount);
  const el = document.getElementById('mines-mult');
  if (el) el.textContent = m.toFixed(2) + '×';
}

function cashoutMines() {
  if (!minesState.active) return;
  const mult = getMinesMult(minesState.gemsFound, minesState.mineCount);
  const bet  = minesState.betAmt;
  const pnl  = +(bet * (mult - 1)).toFixed(2);
  minesState.active = false;

  // Reveal board
  minesState.revealed = minesState.revealed.map(() => true);
  renderMinesGrid();

  updateBalance(pnl, 'Mines', bet, mult);
  showToast(`💎 Cashed out ${mult.toFixed(2)}× +$${pnl.toFixed(2)}`, 'win');
  document.getElementById('mines-start-btn').style.display = 'block';
  document.getElementById('mines-cashout-btn').style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════════════════
// PLINKO
// ══════════════════════════════════════════════════════════════════════════════
const PLINKO_ROWS = 12;
const PLINKO_MULTIPLIERS = [0, 0.3, 0.5, 1, 2, 3, 5, 3, 2, 1, 0.5, 0.3, 0, 0];

let plinkoState = { dropping: false, history: [] };
let plinkoAnimations = [];

function initPlinko() {
  drawPlinkoBoard();
}

function drawPlinkoBoard() {
  const canvas = document.getElementById('plinko-canvas');
  if (!canvas) return;
  canvas.width  = canvas.offsetWidth  || 500;
  canvas.height = canvas.offsetHeight || 420;
  const ctx = canvas.getContext('2d');
  drawPlinkoStatic(ctx, canvas.width, canvas.height);
}

function drawPlinkoStatic(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const rows = PLINKO_ROWS;
  const padX = 40;
  const padY = 30;
  const rowH = (H - padY * 2 - 60) / rows;

  // Pins
  for (let r = 0; r < rows; r++) {
    const cols = r + 3;
    const startX = W/2 - (cols-1) * (W - padX*2) / (2 * (rows + 2));
    const spacing = (W - padX*2) / (rows + 2);

    for (let c = 0; c < cols; c++) {
      const x = startX + c * spacing;
      const y = padY + r * rowH + rowH/2;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fill();
    }
  }

  // Buckets
  const bucketCount = PLINKO_MULTIPLIERS.length;
  const bucketW = (W - padX*2) / bucketCount;
  PLINKO_MULTIPLIERS.forEach((m, i) => {
    const x = padX + i * bucketW;
    const y = H - 50;
    const hue = m >= 3 ? '#00e701' : m >= 1 ? '#f5a623' : '#64748b';
    ctx.fillStyle = hue + '22';
    ctx.strokeStyle = hue;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x+1, y, bucketW-2, 40, 4);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = hue;
    ctx.font = 'bold 11px Nunito Sans';
    ctx.textAlign = 'center';
    ctx.fillText(m + '×', x + bucketW/2, y + 24);
  });
}

async function dropPlinko() {
  if (plinkoState.dropping) return;
  if (!requireAuth()) return;

  const bet = parseFloat(document.getElementById('plinko-bet')?.value || 0);
  if (!validateBet(bet)) return;

  plinkoState.dropping = true;

  const canvas = document.getElementById('plinko-canvas');
  if (!canvas) { plinkoState.dropping = false; return; }
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Simulate path
  let col = 0;
  for (let r = 0; r < PLINKO_ROWS; r++) {
    col += Math.random() < .5 ? 0 : 1;
  }
  const bucketIdx = Math.min(col, PLINKO_MULTIPLIERS.length - 1);
  const mult = PLINKO_MULTIPLIERS[bucketIdx];

  // Animate ball dropping
  const rows = PLINKO_ROWS;
  const padX = 40, padY = 30;
  const rowH = (H - padY * 2 - 60) / rows;
  const bucketW = (W - padX*2) / PLINKO_MULTIPLIERS.length;

  let ballX = W / 2;
  const targetX = padX + (bucketIdx + 0.5) * bucketW;
  const steps = 60;

  for (let s = 0; s <= steps; s++) {
    await sleep(16);
    drawPlinkoStatic(ctx, W, H);
    const t = s / steps;
    const bx = ballX + (targetX - ballX) * t;
    const by = padY + rowH/2 + t * (H - padY - rowH - 60);
    // Slight wobble
    const wobble = Math.sin(t * Math.PI * 6) * 6 * (1-t);
    ctx.beginPath();
    ctx.arc(bx + wobble, by, 8, 0, Math.PI*2);
    const ballGrad = ctx.createRadialGradient(bx+wobble-2, by-2, 1, bx+wobble, by, 8);
    ballGrad.addColorStop(0, '#fff');
    ballGrad.addColorStop(1, '#00e701');
    ctx.fillStyle = ballGrad;
    ctx.fill();
  }

  const pnl = mult >= 1 ? +(bet * (mult - 1)).toFixed(2) : -(bet * (1 - mult)).toFixed(2);
  await updateBalance(pnl, 'Plinko', bet, mult);
  showToast(pnl >= 0 ? `🎯 ${mult}× +$${pnl.toFixed(2)}` : `🎯 ${mult}× -$${Math.abs(pnl).toFixed(2)}`, pnl >= 0 ? 'win' : 'loss');

  const hist = document.getElementById('plinko-history');
  if (hist) {
    const chip = document.createElement('span');
    chip.className = `hist-chip ${mult >= 1 ? 'win' : 'loss'}`;
    chip.textContent = mult + '×';
    hist.prepend(chip);
    if (hist.children.length > 12) hist.lastChild.remove();
  }

  plinkoState.dropping = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// LIMBO
// ══════════════════════════════════════════════════════════════════════════════
let limboState = { spinning: false };

function initLimbo() {}

async function rollLimbo() {
  if (limboState.spinning) return;
  if (!requireAuth()) return;

  const bet    = parseFloat(document.getElementById('limbo-bet')?.value || 0);
  const target = parseFloat(document.getElementById('limbo-target')?.value || 2);
  if (!validateBet(bet)) return;
  if (isNaN(target) || target < 1.01) { showToast('Target must be ≥ 1.01×', 'info'); return; }

  limboState.spinning = true;
  const btn = document.getElementById('limbo-btn');
  btn.disabled = true;

  const resultEl = document.getElementById('limbo-result');
  resultEl.className = 'limbo-result idle';

  // Spin animation
  const ticks = 40;
  for (let i = 0; i < ticks; i++) {
    await sleep(30 + i * 2);
    const fakeVal = (Math.random() * 100 + 1).toFixed(2);
    resultEl.textContent = fakeVal + '×';
  }

  // Actual result: house edge ~1%
  const u      = Math.random();
  const result = Math.floor(100 / (u * 100 + 1) * 100) / 100;
  const win    = result >= target;
  const mult   = win ? target : 0;
  const pnl    = win ? +(bet * (target - 1)).toFixed(2) : -bet;

  resultEl.textContent = result.toFixed(2) + '×';
  resultEl.className   = 'limbo-result ' + (win ? 'win' : 'loss');

  await updateBalance(pnl, 'Limbo', bet, mult);
  showToast(win ? `🚀 Win! ${result.toFixed(2)}× +$${pnl.toFixed(2)}` : `🚀 Loss -$${bet.toFixed(2)}`, win ? 'win' : 'loss');

  const hist = document.getElementById('limbo-history');
  if (hist) {
    const chip = document.createElement('span');
    chip.className = `hist-chip ${win ? 'win' : 'loss'}`;
    chip.textContent = result.toFixed(2) + '×';
    hist.prepend(chip);
    if (hist.children.length > 15) hist.lastChild.remove();
  }

  limboState.spinning = false;
  btn.disabled = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// CHICKEN JUMP (simple multi-row safe/dangerous)
// ══════════════════════════════════════════════════════════════════════════════
let chickenState = {
  active: false,
  betAmt: 0,
  currentRow: 0,
  totalRows: 8,
  board: [],  // each row: ['safe','danger','safe'] etc
  mult: 1.0
};

function initChicken() {
  renderChickenIdle();
}

function renderChickenIdle() {
  const stage = document.getElementById('chicken-stage');
  if (!stage) return;
  stage.innerHTML = '<div style="text-align:center;padding-top:120px;color:var(--text3);font-size:.9rem">Place a bet to start!</div>';
}

function startChicken() {
  if (!requireAuth()) return;
  const bet = parseFloat(document.getElementById('chicken-bet')?.value || 0);
  if (!validateBet(bet)) return;

  chickenState.active     = true;
  chickenState.betAmt     = bet;
  chickenState.currentRow = 0;
  chickenState.mult       = 1.0;
  chickenState.board      = generateChickenBoard(8, 3);

  renderChickenGame();
  document.getElementById('chicken-start-btn').style.display   = 'none';
  document.getElementById('chicken-cashout-btn').style.display = 'block';
  document.getElementById('chicken-mult').textContent = '1.00×';
}

function generateChickenBoard(rows, cols) {
  // ~22.2% cook chance per row → 1.18× mult
  return Array.from({ length: rows }, () => {
    const arr = Array(cols).fill('safe');
    const dangerIdx = Math.floor(Math.random() * cols);
    arr[dangerIdx] = 'danger';
    return arr;
  });
}

function pickChickenCol(col) {
  if (!chickenState.active) return;
  const row = chickenState.board[chickenState.currentRow];
  const result = row[col];

  if (result === 'danger') {
    // Cooked!
    const bet = chickenState.betAmt;
    chickenState.active = false;
    revealChickenRow(col, 'danger');
    updateBalance(-bet, 'Chicken Jump', bet, 0);
    showToast(`🍗 Cooked! -$${bet.toFixed(2)}`, 'loss');
    document.getElementById('chicken-start-btn').style.display   = 'block';
    document.getElementById('chicken-cashout-btn').style.display = 'none';
    document.getElementById('chicken-mult').textContent = '0.00×';
  } else {
    chickenState.mult = +(chickenState.mult * 1.18).toFixed(4);
    revealChickenRow(col, 'safe');
    chickenState.currentRow++;
    document.getElementById('chicken-mult').textContent = chickenState.mult.toFixed(2) + '×';

    if (chickenState.currentRow >= chickenState.totalRows) {
      cashoutChicken();
    }
  }
}

function revealChickenRow(pickedCol, result) {
  // Update grid display
  renderChickenGame(pickedCol, result);
}

function renderChickenGame(revealedCol, revealedResult) {
  const stage = document.getElementById('chicken-stage');
  if (!stage) return;

  const rowH = 44;
  const cols = 3;
  stage.innerHTML = '';

  for (let r = chickenState.totalRows - 1; r >= 0; r--) {
    const rowEl = document.createElement('div');
    rowEl.className = 'platform-row';
    rowEl.style.bottom = (30 + (r) * (rowH + 8)) + 'px';

    for (let c = 0; c < cols; c++) {
      const pl = document.createElement('div');
      pl.className = 'platform';

      if (r < chickenState.currentRow) {
        // Past row - show result
        pl.classList.add('safe-revealed');
        pl.textContent = '✓';
        pl.style.fontSize = '.7rem';
        pl.style.color = 'var(--accent)';
        pl.style.display = 'flex';
        pl.style.alignItems = 'center';
        pl.style.justifyContent = 'center';
      } else if (r === chickenState.currentRow && revealedCol !== undefined) {
        if (c === revealedCol) {
          pl.classList.add(revealedResult === 'safe' ? 'safe-revealed' : 'danger-revealed');
        }
      } else if (r === chickenState.currentRow) {
        pl.style.cursor = 'pointer';
        pl.style.border = '1px solid var(--accent)';
        pl.addEventListener('click', () => pickChickenCol(c));
      } else {
        pl.style.opacity = '.4';
      }

      rowEl.appendChild(pl);
    }
    stage.appendChild(rowEl);
  }

  // Chicken
  const chick = document.createElement('div');
  chick.className = 'chicken-sprite';
  chick.textContent = '🐔';
  const currRow = chickenState.currentRow;
  chick.style.bottom = (20 + currRow * (rowH + 8)) + 'px';
  chick.style.left = '50%';
  chick.style.transform = 'translateX(-50%)';
  stage.appendChild(chick);
}

function cashoutChicken() {
  if (!chickenState.active) return;
  const mult = chickenState.mult;
  const bet  = chickenState.betAmt;
  const pnl  = +(bet * (mult - 1)).toFixed(2);
  chickenState.active = false;
  updateBalance(pnl, 'Chicken Jump', bet, mult);
  showToast(`🐔 Cashed out ${mult.toFixed(2)}× +$${pnl.toFixed(2)}`, 'win');
  document.getElementById('chicken-start-btn').style.display   = 'block';
  document.getElementById('chicken-cashout-btn').style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════════════
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function requireAuth() {
  if (!UB.user) {
    showAuth('login');
    showToast('Please sign in first', 'info');
    return false;
  }
  return true;
}

function validateBet(bet) {
  if (isNaN(bet) || bet <= 0) { showToast('Enter a valid bet amount', 'info'); return false; }
  if (bet > UB.balance)       { showToast('Insufficient balance', 'info'); return false; }
  return true;
}

function showResultBadge(id, win, pnl) {
  const el = document.getElementById(id);
  if (!el) return;
  const badge = el.querySelector('.result-badge');
  if (!badge) return;
  badge.className = `result-badge ${win ? 'win' : 'loss'}`;
  badge.textContent = win ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
  setTimeout(() => badge.classList.add('show'), 10);
  setTimeout(() => badge.classList.remove('show'), 2500);
}

// Quick bet helpers
function halfBet(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.value = Math.max(0.01, parseFloat(el.value||0) / 2).toFixed(2);
}
function doubleBet(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.value = Math.min(UB.balance, parseFloat(el.value||0) * 2).toFixed(2);
}
function maxBet(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.value = UB.balance.toFixed(2);
}
