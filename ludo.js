// ─────────────── CONSTANTS ───────────────

const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

const COLORS      = ['red','blue','green','yellow'];
const COLOR_NAMES = { red:'Red', blue:'Blue', green:'Green', yellow:'Yellow' };

// Home zone grid boundaries (top-left / bottom-right row+col)
const HOME_ZONES = {
  red:    { rows:[0,5],  cols:[0,5]  },
  blue:   { rows:[0,5],  cols:[9,14] },
  green:  { rows:[9,14], cols:[9,14] },
  yellow: { rows:[9,14], cols:[0,5]  },
};

// The 4 token spawn positions inside each home area
const HOME_CIRCLES = {
  red:    [{r:1,c:1},{r:1,c:3},{r:3,c:1},{r:3,c:3}],
  blue:   [{r:1,c:10},{r:1,c:12},{r:3,c:10},{r:3,c:12}],
  green:  [{r:10,c:10},{r:10,c:12},{r:12,c:10},{r:12,c:12}],
  yellow: [{r:10,c:1},{r:10,c:3},{r:12,c:1},{r:12,c:3}],
};

// Coloured safe lanes leading to the center
const HOME_COLUMNS = {
  red:    [{r:1,c:7},{r:2,c:7},{r:3,c:7},{r:4,c:7},{r:5,c:7}],
  blue:   [{r:7,c:13},{r:7,c:12},{r:7,c:11},{r:7,c:10},{r:7,c:9}],
  green:  [{r:13,c:7},{r:12,c:7},{r:11,c:7},{r:10,c:7},{r:9,c:7}],
  yellow: [{r:7,c:1},{r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5}],
};

// 56-step main path (row, col pairs)
const MAIN_PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],
  [0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],
  [14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],
  [6,0],
];

// Each colour's entry index into MAIN_PATH
const START_INDEX = { red:0, blue:13, green:26, yellow:39 };

// Safe (★) squares – no captures here
const STAR_CELLS = [
  [2,6],[6,2],[8,12],[12,8],
  [6,12],[12,6],[2,8],[8,2],
  [1,6],[6,1],
];

// ─────────────── GAME STATE ───────────────

let state = {};

function initState() {
  state = {
    currentPlayer:    0,
    diceValue:        null,
    rolled:           false,
    phase:            'roll',   // 'roll' | 'move'
    tokens:           {},
    finishedPlayers:  [],
    gameOver:         false,
    consecutiveSixes: 0,
  };

  COLORS.forEach(color => {
    state.tokens[color] = [0,1,2,3].map(i => ({
      id:       i,
      color,
      position: -1,  // -1 = home base | 0-55 = main path | 56-59 = home column | 99 = finished
    }));
  });
}

// ─────────────── POSITION HELPERS ───────────────

/** Convert a colour-relative position (0-55) to an absolute MAIN_PATH index. */
function relToAbs(rel, color) {
  return (START_INDEX[color] + rel) % 56;
}

/** Return [row, col] for a token, or null if it is finished. */
function getCellForToken(token) {
  if (token.position === -1) {
    const hp = HOME_CIRCLES[token.color][token.id];
    return [hp.r, hp.c];
  }
  if (token.position === 99) return null;
  if (token.position >= 56) {
    const idx = token.position - 56;   // 0..3
    const hc  = HOME_COLUMNS[token.color];
    return [hc[idx].r, hc[idx].c];
  }
  return MAIN_PATH[relToAbs(token.position, token.color)];
}

// ─────────────── BOARD CONSTRUCTION ───────────────

function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const cell       = document.createElement('div');
      cell.className   = 'cell';
      cell.dataset.r   = r;
      cell.dataset.c   = c;
      const cls = getCellClass(r, c);
      if (cls) cls.split(' ').forEach(x => cell.classList.add(x));
      board.appendChild(cell);
    }
  }
}

function getCellClass(r, c) {
  // Large home quadrants
  if (r <= 5 && c <= 5) return 'home-red';
  if (r <= 5 && c >= 9) return 'home-blue';
  if (r >= 9 && c >= 9) return 'home-green';
  if (r >= 9 && c <= 5) return 'home-yellow';

  // Center 3×3 – coloured triangles + white centre
  if (r === 6 && c === 6) return 'center-red';
  if (r === 6 && c === 7) return 'center-red';
  if (r === 7 && c === 6) return 'center-yellow';
  if (r === 6 && c === 8) return 'center-blue';
  if (r === 7 && c === 8) return 'center-blue';
  if (r === 8 && c === 8) return 'center-green';
  if (r === 8 && c === 7) return 'center-green';
  if (r === 8 && c === 6) return 'center-yellow';
  if (r === 7 && c === 7) return 'center-white';

  // Coloured home-column lanes (and each colour's start square)
  for (const color of COLORS) {
    for (const pos of HOME_COLUMNS[color]) {
      if (pos.r === r && pos.c === c) return `safe-${color}`;
    }
    const [sr, sc] = MAIN_PATH[START_INDEX[color]];
    if (r === sr && c === sc) return `safe-${color}`;
  }

  // Star safe squares
  for (const [sr, sc] of STAR_CELLS) {
    if (r === sr && c === sc) return 'star';
  }

  return '';
}

// ─────────────── RENDERING ───────────────

function renderTokens() {
  // Clear all tokens
  document.querySelectorAll('.cell').forEach(cell => { cell.innerHTML = ''; });

  // Group tokens by cell key
  const cellMap = {};
  COLORS.forEach(color => {
    state.tokens[color].forEach(token => {
      if (token.position === 99) return;
      const cell = getCellForToken(token);
      if (!cell) return;
      const key = `${cell[0]},${cell[1]}`;
      (cellMap[key] = cellMap[key] || []).push(token);
    });
  });

  Object.entries(cellMap).forEach(([key, tokens]) => {
    const [r, c] = key.split(',').map(Number);
    const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (!cellEl) return;
    // Show first token; if multiple, display count badge
    cellEl.appendChild(createTokenEl(tokens[0], tokens.length > 1, tokens.length));
  });
}

function createTokenEl(token, multiple, count) {
  const div       = document.createElement('div');
  div.className   = `token ${token.color}`;
  if (multiple) {
    div.classList.add('multiple');
    div.textContent = count;
  }
  if (state.phase === 'move' && isTokenMovable(token)) {
    div.classList.add('movable');
  }
  div.addEventListener('click', () => moveToken(token));
  return div;
}

// ─────────────── GAME LOGIC ───────────────

function getCurrentColor() {
  return COLORS[state.currentPlayer];
}

function isTokenMovable(token) {
  if (state.phase !== 'move')              return false;
  if (token.color !== getCurrentColor())   return false;
  if (token.position === 99)               return false;

  const dice = state.diceValue;

  if (token.position === -1) return dice === 6;           // needs 6 to exit home

  if (token.position >= 56) {
    const homeStep = token.position - 56;                 // 0..3
    return homeStep + dice <= 3;                          // can reach last safe cell (index 3)
  }

  const newRel = token.position + dice;
  return newRel <= 57;                                    // can't overshoot home column
}

function hasAnyMovableToken() {
  return state.tokens[getCurrentColor()].some(t => isTokenMovable(t));
}

function rollDice() {
  if (state.rolled || state.phase !== 'roll' || state.gameOver) return;

  const btn    = document.getElementById('roll-btn');
  const diceEl = document.getElementById('dice');
  btn.disabled = true;
  diceEl.classList.add('rolling');

  let flashes = 0;
  const interval = setInterval(() => {
    diceEl.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
    flashes++;
    if (flashes >= 8) {
      clearInterval(interval);
      diceEl.classList.remove('rolling');
      const val        = Math.floor(Math.random() * 6) + 1;
      state.diceValue  = val;
      diceEl.textContent = DICE_FACES[val - 1];
      state.rolled     = true;
      afterRoll();
    }
  }, 80);
}

function afterRoll() {
  const color = getCurrentColor();
  addLog(`<span class="${color}">${COLOR_NAMES[color]}</span> rolled <strong>${state.diceValue}</strong>`);

  if (!hasAnyMovableToken()) {
    addLog(`No moves available for <span class="${color}">${COLOR_NAMES[color]}</span>`);
    setTimeout(() => nextTurn(), 900);
    return;
  }

  const movable = state.tokens[color].filter(t => isTokenMovable(t));
  state.phase   = 'move';
  renderTokens();

  if (movable.length === 1) {
    setTimeout(() => moveToken(movable[0]), 400);
  } else {
    updateUI();
  }
}

function moveToken(token) {
  if (!isTokenMovable(token)) return;

  const color    = getCurrentColor();
  const dice     = state.diceValue;
  let captured   = false;

  if (token.position === -1) {
    // Exit home
    token.position = 0;
    addLog(`<span class="${color}">${COLOR_NAMES[color]}</span> brings out a token!`);
    captured = checkCapture(token);

  } else if (token.position >= 56) {
    // Move along home column
    token.position += dice;
    if (token.position >= 60) {
      token.position = 99;
      addLog(`<span class="${color}">${COLOR_NAMES[color]}</span> finishes a token! 🎉`);
      checkWin();
    }

  } else {
    // Move on main path
    const newPos = token.position + dice;
    if (newPos >= 57) {
      // Enter home column
      token.position = 56 + (newPos - 57);
      addLog(`<span class="${color}">${COLOR_NAMES[color]}</span> enters the home stretch!`);
    } else {
      token.position = newPos;
      captured = checkCapture(token);
    }
  }

  state.phase  = 'roll';
  state.rolled = false;
  renderTokens();
  updateUI();

  // Bonus turn on 6 or capture
  if (dice === 6 || captured) {
    state.consecutiveSixes = (dice === 6) ? state.consecutiveSixes + 1 : 0;
    if (state.consecutiveSixes >= 3) {
      addLog(`<span class="${color}">${COLOR_NAMES[color]}</span> rolled three 6s — turn passes!`);
      state.consecutiveSixes = 0;
      nextTurn();
    } else {
      addLog(`<span class="${color}">${COLOR_NAMES[color]}</span> gets another turn!`);
      document.getElementById('roll-btn').disabled = false;
    }
  } else {
    state.consecutiveSixes = 0;
    if (!state.gameOver) nextTurn();
  }
}

function checkCapture(token) {
  const cell = getCellForToken(token);
  if (!cell) return false;

  const [r, c]  = cell;
  const cellCls = getCellClass(r, c);
  const isSafe  = cellCls && (cellCls.includes('star') || cellCls.includes('safe-'));
  if (isSafe) return false;

  let captured = false;
  COLORS.forEach(other => {
    if (other === token.color) return;
    state.tokens[other].forEach(opp => {
      if (opp.position === 99 || opp.position === -1) return;
      const oppCell = getCellForToken(opp);
      if (!oppCell) return;
      if (oppCell[0] === r && oppCell[1] === c) {
        opp.position = -1;
        addLog(`<span class="${token.color}">${COLOR_NAMES[token.color]}</span> captures <span class="${other}">${COLOR_NAMES[other]}</span>'s token! 💥`);
        captured = true;
      }
    });
  });
  return captured;
}

function checkWin() {
  const color       = getCurrentColor();
  const allFinished = state.tokens[color].every(t => t.position === 99);
  if (allFinished) {
    state.gameOver = true;
    const titleEl  = document.getElementById('win-title');
    titleEl.textContent = `${COLOR_NAMES[color]} Wins! 🏆`;
    titleEl.style.color = `var(--${color})`;
    document.getElementById('win-overlay').classList.add('show');
  }
}

function nextTurn() {
  state.currentPlayer = (state.currentPlayer + 1) % 4;
  state.rolled        = false;
  state.phase         = 'roll';
  document.getElementById('roll-btn').disabled = false;
  updateUI();
  renderTokens();
}

// ─────────────── UI UPDATES ───────────────

function updateUI() {
  const color = getCurrentColor();

  const turnLabel   = document.getElementById('turn-label');
  turnLabel.textContent = `${COLOR_NAMES[color]}'s Turn`;
  turnLabel.style.color = `var(--${color})`;

  document.getElementById('action-label').textContent =
    state.phase === 'move' ? 'Click a glowing token to move'
    : state.rolled         ? 'No valid moves…'
    : 'Roll the dice!';

  // Rebuild players list
  const list = document.getElementById('players-list');
  list.innerHTML = '';
  COLORS.forEach((c, i) => {
    const row      = document.createElement('div');
    const atHome   = state.tokens[c].filter(t => t.position === -1).length;
    const finished = state.tokens[c].filter(t => t.position === 99).length;
    row.className  = 'player-row' + (i === state.currentPlayer ? ' active' : '');
    row.innerHTML  = `
      <div class="player-dot ${c}"></div>
      <div class="player-name">${COLOR_NAMES[c]}</div>
      <div class="player-home">${finished === 4 ? '✅' : atHome + ' home'}</div>
      ${finished === 4 ? '<div class="player-crown">🏅</div>' : ''}
    `;
    list.appendChild(row);
  });
}

function addLog(msg) {
  const log   = document.getElementById('game-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = msg;
  log.insertBefore(entry, log.firstChild);
  if (log.children.length > 30) log.removeChild(log.lastChild);
}

// ─────────────── RESTART ───────────────

function restartGame() {
  document.getElementById('win-overlay').classList.remove('show');
  initState();
  buildBoard();
  renderTokens();
  updateUI();
  document.getElementById('roll-btn').disabled  = false;
  document.getElementById('dice').textContent   = '🎲';
  document.getElementById('game-log').innerHTML = '';
  addLog('New game started! <span class="red">Red</span> goes first.');
}

// ─────────────── INIT ───────────────

buildBoard();
initState();
renderTokens();
updateUI();
addLog('<span class="red">Red</span> goes first — roll the dice!');
