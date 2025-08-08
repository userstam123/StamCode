const INITIAL_BALANCE = 1000; // DC
const MIN_BET = 1;
const MAX_BET = 100;
const BET_STEP = 5;

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "🍀", "7️⃣"];
// Rarer symbols have lower weights
const WEIGHTS = { "🍒": 6, "🍋": 6, "🔔": 4, "⭐": 3, "🍀": 2, "7️⃣": 1 };
// 3-in-a-row payouts (multiplier of total bet)
const PAYTABLE = { "🍒": 2, "🍋": 2, "🔔": 4, "⭐": 6, "🍀": 8, "7️⃣": 12 };
// 3x3 lines: 3 rows + 2 diagonals
const LINES = [
  // rows
  [{r:0,c:0},{r:0,c:1},{r:0,c:2}],
  [{r:1,c:0},{r:1,c:1},{r:1,c:2}],
  [{r:2,c:0},{r:2,c:1},{r:2,c:2}],
  // diagonals
  [{r:0,c:0},{r:1,c:1},{r:2,c:2}],
  [{r:2,c:0},{r:1,c:1},{r:0,c:2}],
];

const balanceEl = document.getElementById("balance");
const betEl = document.getElementById("bet");
const betDownBtn = document.getElementById("betDown");
const betUpBtn = document.getElementById("betUp");
const spinBtn = document.getElementById("spinBtn");
const turboCheckbox = document.getElementById("turbo");
const gridEl = document.getElementById("grid");
const winBanner = document.getElementById("winBanner");
const fxCanvas = document.getElementById("fxCanvas");

const cells = Array.from(gridEl.querySelectorAll(".cell"));

let balance = INITIAL_BALANCE;
let bet = 10;
let isSpinning = false;

function updateHUD(){
  balanceEl.textContent = balance.toString();
  betEl.textContent = bet.toString();
}

function clampBet(value){
  return Math.max(MIN_BET, Math.min(MAX_BET, Math.round(value)));
}

betDownBtn.addEventListener("click", () => {
  bet = clampBet(bet - BET_STEP);
  updateHUD();
});

betUpBtn.addEventListener("click", () => {
  bet = clampBet(bet + BET_STEP);
  updateHUD();
});

function weightedRandomSymbol(){
  const entries = Object.entries(WEIGHTS);
  const total = entries.reduce((acc, [,w]) => acc + w, 0);
  let roll = Math.random() * total;
  for(const [sym, w] of entries){
    if(roll < w) return sym;
    roll -= w;
  }
  return SYMBOLS[0];
}

function generateSpinResult(){
  // 3x3 matrix [row][col]
  const m = [[],[],[]];
  for(let c=0;c<3;c++){
    for(let r=0;r<3;r++){
      m[r][c] = weightedRandomSymbol();
    }
  }
  return m;
}

function clearWinHighlights(){
  cells.forEach(cell => cell.classList.remove("win"));
}

function cellAt(r,c){
  return gridEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function showMatrix(m){
  for(let r=0;r<3;r++){
    for(let c=0;c<3;c++){
      const cell = cellAt(r,c);
      if(cell) cell.textContent = m[r][c];
    }
  }
}

function startSpinVisual(){
  // Add spinning class by column for subtle staged effect
  const byCol = [[],[],[]];
  cells.forEach(cell => {
    const col = Number(cell.getAttribute("data-col"));
    byCol[col].push(cell);
  });

  const durations = turboCheckbox.checked ? [250, 300, 350] : [600, 800, 1000];
  // during spin, shuffle symbols in each column quickly
  const intervals = [];
  byCol.forEach((colCells, idx) => {
    colCells.forEach(c => c.classList.add("spinning"));
    const interval = setInterval(() => {
      colCells.forEach(c => {
        c.textContent = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
      });
    }, turboCheckbox.checked ? 40 : 75);
    intervals.push(interval);
    setTimeout(() => {
      clearInterval(interval);
      colCells.forEach(c => c.classList.remove("spinning"));
    }, durations[idx]);
  });

  const totalDuration = Math.max(...(turboCheckbox.checked ? [350] : [1000])) + 30;
  return totalDuration;
}

function evaluateWins(m){
  // Return { totalWin, wins: [{lineIdx, symbol, cells:[{r,c}]}] }
  const wins = [];
  for(let i=0;i<LINES.length;i++){
    const line = LINES[i];
    const [a,b,c] = line.map(p => m[p.r][p.c]);
    if(a === b && b === c){
      wins.push({ lineIdx: i, symbol: a, cells: line });
    }
  }
  const totalWin = wins.reduce((sum, w) => sum + (PAYTABLE[w.symbol] * bet), 0);
  return { totalWin, wins };
}

function flashWins(wins){
  wins.forEach(w => {
    w.cells.forEach(({r,c}) => {
      cellAt(r,c).classList.add("win");
    });
  });
  if(wins.length){
    setTimeout(() => clearWinHighlights(), 1200);
  }
}

function showWinBanner(amount){
  if(amount <= 0) return;
  winBanner.textContent = `WIN +${amount} DC`;
  winBanner.classList.remove("hidden");
  // force reflow to restart transition
  // eslint-disable-next-line no-unused-expressions
  winBanner.offsetHeight;
  winBanner.classList.add("show");
  setTimeout(() => {
    winBanner.classList.remove("show");
    setTimeout(() => winBanner.classList.add("hidden"), 250);
  }, 1200);
}

// Lightweight confetti
const confetti = (() => {
  const ctx = fxCanvas.getContext("2d");
  let particles = [];
  let rafId = null;
  const colors = ["#66f7d4", "#7a7dff", "#ffd36d", "#ff6b6b", "#a2ff9b"]; 

  function spawn(count){
    const { width, height } = fxCanvas.getBoundingClientRect();
    fxCanvas.width = Math.floor(width * window.devicePixelRatio);
    fxCanvas.height = Math.floor(height * window.devicePixelRatio);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    particles = Array.from({length: count}, () => ({
      x: Math.random() * width,
      y: -10 - Math.random() * 40,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random()*colors.length)],
      vx: -1.5 + Math.random() * 3,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: -0.1 + Math.random() * 0.2,
      life: 60 + Math.random() * 30
    }));
    if(!rafId){ rafId = requestAnimationFrame(tick); }
  }
  function tick(){
    const { width, height } = fxCanvas.getBoundingClientRect();
    ctx.clearRect(0,0,width,height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.rot += p.vr;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
      ctx.restore();
    });
    particles = particles.filter(p => p.life > 0 && p.y < height + 20);
    if(particles.length){
      rafId = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafId);
      rafId = null;
      ctx.clearRect(0,0,width,height);
    }
  }
  return { spawn };
})();

function setSpinningState(state){
  isSpinning = state;
  spinBtn.disabled = state;
  betDownBtn.disabled = state;
  betUpBtn.disabled = state;
  turboCheckbox.disabled = state;
}

function spin(){
  if(isSpinning) return;
  if(balance < bet){
    // brief shake effect on low balance
    spinBtn.animate([{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}], { duration: 220, easing: 'ease-out' });
    return;
  }

  clearWinHighlights();
  setSpinningState(true);

  balance -= bet;
  updateHUD();

  const visualDuration = startSpinVisual();
  const matrix = generateSpinResult();

  // Reveal columns sequentially to mimic reels stopping
  const colStopDelay = turboCheckbox.checked ? 120 : 220;
  setTimeout(() => showColumn(matrix, 0), visualDuration - colStopDelay*3);
  setTimeout(() => showColumn(matrix, 1), visualDuration - colStopDelay*2);
  setTimeout(() => showColumn(matrix, 2), visualDuration - colStopDelay*1);

  setTimeout(() => {
    const { totalWin, wins } = evaluateWins(matrix);
    if(totalWin > 0){
      balance += totalWin;
      flashWins(wins);
      showWinBanner(totalWin);
      if(totalWin >= bet * 5){
        confetti.spawn(120);
      } else {
        confetti.spawn(40);
      }
    }
    updateHUD();
    setSpinningState(false);
  }, visualDuration + 40);
}

function showColumn(matrix, col){
  for(let r=0;r<3;r++){
    cellAt(r,col).textContent = matrix[r][col];
  }
}

spinBtn.addEventListener("click", spin);

// Initialize
updateHUD();