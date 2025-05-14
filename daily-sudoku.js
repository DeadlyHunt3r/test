(() => {
  // === CONFIGURATION ===
  const GRID_SIZE = 9;
  const REMOVE_COUNT = 40;
  const STORAGE_KEYS = {
    accumulated: 'sudokuTimerAccumulated',
    start: 'sudokuTimerStart',
    board: 'sudokuBoard',
    initial: 'sudokuInitial',
    date: 'sudokuDate',
    user: 'currentUser'
  };

  // === DOM ELEMENTS ===
  const timerEl      = document.getElementById('timer');
  const container    = document.getElementById('sudoku-container');
  const messageEl    = document.getElementById('message');
  const checkBtn     = document.getElementById('checkButton');
  const resetBtn     = document.getElementById('resetButton');
  const infoIcon     = document.getElementById('info-icon');
  const infoModal    = document.getElementById('info-modal');
  const closeModal   = infoModal.querySelector('.close');
  const zoomIcon     = document.getElementById('zoom-icon');
  const zoomMsg      = document.getElementById('zoom-message');
  const gameArea     = document.getElementById('game-area');

  // === STATE ===
  let timerInterval, timerStart = null;
  let accumulatedTime = parseInt(localStorage.getItem(STORAGE_KEYS.accumulated), 10) || 0;
  let board = [], initialBoard = [];

  // === TIMER LOGIC ===
  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateTimer() {
    const nowElapsed = timerStart ? Date.now() - timerStart : 0;
    timerEl.textContent = formatTime(accumulatedTime + nowElapsed);
  }

  function startTimer() {
    if (!timerStart) {
      timerStart = Date.now();
      localStorage.setItem(STORAGE_KEYS.start, timerStart);
      timerInterval = setInterval(updateTimer, 1000);
    }
  }

  function pauseTimer() {
    if (timerStart) {
      accumulatedTime += Date.now() - timerStart;
      localStorage.setItem(STORAGE_KEYS.accumulated, accumulatedTime);
      timerStart = null;
      clearInterval(timerInterval);
    }
  }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? pauseTimer() : startTimer();
  });

  // === DATE RESET ===
  const today = new Date().toISOString().slice(0,10);
  if (localStorage.getItem(STORAGE_KEYS.date) !== today) {
    [STORAGE_KEYS.board, STORAGE_KEYS.initial, STORAGE_KEYS.start, STORAGE_KEYS.accumulated].forEach(key => localStorage.removeItem(key));
    localStorage.setItem(STORAGE_KEYS.date, today);
    accumulatedTime = 0;
    timerStart = null;
  }

  // === RANDOM SEED ===
  function mulberry32(seed) {
    return () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const dateSeed = parseInt(today.replace(/-/g, ''), 10);
  const rand     = mulberry32(dateSeed);

  // === SUDOKU GENERATOR ===
  function isSafe(grid, r, c, n) {
    for (let i = 0; i < GRID_SIZE; i++) {
      if (grid[r][i] === n || grid[i][c] === n) return false;
    }
    const br = r - (r % 3), bc = c - (c % 3);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if (grid[br+i][bc+j] === n) return false;
    }
    return true;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function fillBoard(grid, idx = 0) {
    if (idx === GRID_SIZE * GRID_SIZE) return true;
    const r = Math.floor(idx / GRID_SIZE), c = idx % GRID_SIZE;
    if (grid[r][c]) return fillBoard(grid, idx + 1);
    const nums = [...Array(GRID_SIZE)].map((_, i) => i + 1);
    shuffle(nums);
    for (const n of nums) {
      if (isSafe(grid, r, c, n)) {
        grid[r][c] = n;
        if (fillBoard(grid, idx + 1)) return true;
      }
    }
    grid[r][c] = 0;
    return false;
  }

  function removeCells(grid) {
    let toRemove = REMOVE_COUNT;
    while (toRemove > 0) {
      const i = Math.floor(rand() * GRID_SIZE);
      const j = Math.floor(rand() * GRID_SIZE);
      if (grid[i][j]) {
        grid[i][j] = 0;
        toRemove--;
      }
    }
  }

  function generate() {
    board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    fillBoard(board);
    removeCells(board);
    initialBoard = board.map(r => [...r]);
    localStorage.setItem(STORAGE_KEYS.initial, JSON.stringify(initialBoard));
    localStorage.setItem(STORAGE_KEYS.board, JSON.stringify(board));
  }

  // === LOAD OR GENERATE ===
  const savedInitial = localStorage.getItem(STORAGE_KEYS.initial);
  const savedBoard   = localStorage.getItem(STORAGE_KEYS.board);
  if (savedInitial && savedBoard) {
    initialBoard = JSON.parse(savedInitial);
    board = JSON.parse(savedBoard);
  } else {
    generate();
  }
  render(); startTimer();

  // === RENDER ===
  function render() {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    board.forEach((row, i) => row.forEach((val, j) => {
      const cell = document.createElement('div');
      cell.className = `cell ${initialBoard[i][j] ? 'fixed':'editable'}`;
      // Inline borders zur Trennung der 3x3-Blöcke
      cell.style.borderTop    = (i % 3 === 0) ? '2px solid #555' : '1px solid #555';
      cell.style.borderLeft   = (j % 3 === 0) ? '2px solid #555' : '1px solid #555';
      cell.style.borderRight  = ((j + 1) % 3 === 0) ? '2px solid #555' : '1px solid #555';
      cell.style.borderBottom = ((i + 1) % 3 === 0) ? '2px solid #555' : '1px solid #555';
      cell.textContent = val || '';
      if (!initialBoard[i][j]) cell.contentEditable = true;
      cell.dataset.rc = `${i},${j}`;
      frag.append(cell);
    }));

    container.append(frag);
  }

  // === EVENT DELEGATION ===
  container.addEventListener('input', e => {
    const c = e.target;
    if (!c.isContentEditable) return;
    const txt = c.textContent.replace(/[^1-9]/g,'').slice(0,1);
    c.textContent = txt;
    const [r,j] = c.dataset.rc.split(',').map(Number);
    board[r][j] = txt ? +txt : 0;
    localStorage.setItem(STORAGE_KEYS.board, JSON.stringify(board));
  });

  container.addEventListener('focusin', e => {
    if (e.target.isContentEditable) e.target.textContent = '';
  });

  // === VALIDATION ===
  function isValid() {
    for (let k = 0; k < GRID_SIZE; k++) {
      const rs = new Set(), cs = new Set();
      for (let m = 0; m < GRID_SIZE; m++) {
        const a = board[k][m], b = board[m][k];
        if (!a || rs.has(a)) return false; rs.add(a);
        if (!b || cs.has(b)) return false; cs.add(b);
      }
    }
    for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
      const bs = new Set();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const v = board[3*br+i][3*bc+j];
        if (!v || bs.has(v)) return false; bs.add(v);
      }
    }
    return true;
  }

  // === BUTTONS ===
  checkBtn.addEventListener('click', () => {
    pauseTimer();
    if (isValid()) {
      const score = Math.floor(accumulatedTime/1000);
      const player = localStorage.getItem(STORAGE_KEYS.user) || 'Guest';
      fetch(`https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec' '&player=${player}&score=${score}`);
      messageEl.innerHTML = 'Herzlichen Glückwunsch!<br>Schau morgen gerne wieder vorbei.';
    } else {
      messageEl.textContent = 'Ungültig!';
    }
  });

  resetBtn.addEventListener('click', () => {
    board = initialBoard.map(r => [...r]);
    localStorage.setItem(STORAGE_KEYS.board, JSON.stringify(board));
    render();
  });

  // === MODAL & ZOOM ===
  infoIcon.onclick  = () => infoModal.style.display = 'block';
  closeModal.onclick = () => infoModal.style.display = 'none';
  window.onclick      = e => { if (e.target === infoModal) infoModal.style.display = 'none'; };
  zoomIcon.onclick = () => {
    const zoomed = gameArea.style.transform === 'scale(1.5)';
    gameArea.style.transform = zoomed ? 'scale(1)' : 'scale(1.5)';
    zoomMsg.style.display = zoomed ? 'none' : 'block';
    setTimeout(() => zoomMsg.style.display = 'none', 2000);
  };
})();
