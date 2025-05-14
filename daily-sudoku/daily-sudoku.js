/***** Timer & LocalStorage Handling *****/
let timerInterval;
let timerRunning = false; // gibt an, ob der Timer aktiv läuft
let timerStart = null;
let accumulatedTime = parseInt(localStorage.getItem("sudokuTimerAccumulated") || "0", 10);

// Aktualisiert die Timeranzeige basierend auf der akkumulierten Zeit und aktueller Laufzeit
function updateTimer() {
  let currentElapsed = 0;
  if (timerStart !== null) {
    currentElapsed = Date.now() - timerStart;
  }
  const totalElapsed = accumulatedTime + currentElapsed;
  const seconds = Math.floor(totalElapsed / 1000);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = minutes + ":" + secs;
}

// Startet den Timer (wird beim ersten Eingabefeld ausgelöst oder wenn die Seite sichtbar wird)
function startTimer() {
  if (!timerRunning) {
    timerRunning = true;
    if (timerStart === null) {
      timerStart = Date.now();
      localStorage.setItem("sudokuTimerStart", timerStart.toString());
    }
    timerInterval = setInterval(updateTimer, 1000);
  }
}

// Pausiert den Timer (z. B. bei Seitenwechsel) und speichert die akkumulierte Zeit
function pauseTimer() {
  if (timerRunning && timerStart !== null) {
    accumulatedTime += Date.now() - timerStart;
    localStorage.setItem("sudokuTimerAccumulated", accumulatedTime.toString());
    timerStart = null;
    localStorage.removeItem("sudokuTimerStart");
    timerRunning = false;
    clearInterval(timerInterval);
  }
}

// Beim Laden prüfen wir, ob ein Timer-Startwert vorhanden ist
if (localStorage.getItem("sudokuTimerStart")) {
  timerStart = parseInt(localStorage.getItem("sudokuTimerStart"), 10);
  timerRunning = true;
  timerInterval = setInterval(updateTimer, 1000);
} else {
  timerRunning = false;
}

// Überwache die Sichtbarkeit der Seite: Bei "hidden" pausieren, bei "visible" fortsetzen
document.addEventListener("visibilitychange", function() {
  if (document.hidden) {
    pauseTimer();
  } else {
    if (accumulatedTime > 0 || timerStart !== null) {
      startTimer();
    }
  }
});

/***** Datum & LocalStorage Reset *****/
// Neue Funktion, die das Datum in lokaler deutscher Zeit (YYYY-MM-DD) zurückgibt
function getLocalDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const currentDate = getLocalDateString();
const savedDate = localStorage.getItem("sudokuDate");
if (savedDate !== currentDate) {
  localStorage.removeItem("sudokuBoard");
  localStorage.removeItem("sudokuInitial");
  localStorage.removeItem("sudokuTimerStart");
  localStorage.removeItem("sudokuTimerAccumulated");
  localStorage.setItem("sudokuDate", currentDate);
  timerStart = null;
  accumulatedTime = 0;
}

/***** Sudoku-Logik *****/
const N = 9;
let board = [];
let initialBoard = []; // speichert das Puzzle des Tages

// Seedable Zufallszahlengenerator (Mulberry32)
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// Erzeuge einen deterministischen Seed aus dem Datum (Format: YYYYMMDD)
function getSeedFromDate() {
  const today = new Date();
  const year = today.getFullYear().toString();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return parseInt(year + month + day, 10);
}

const seed = getSeedFromDate();
const rand = mulberry32(seed);

// Board initialisieren (leeres 9x9 Array)
for (let i = 0; i < N; i++) {
  board[i] = new Array(N).fill(0);
}

// Backtracking: Füllt das Board komplett mit einer gültigen Lösung
function fillBoard(board, row = 0, col = 0) {
  if (col === 9) {
    col = 0;
    row++;
    if (row === 9) return true;
  }
  if (board[row][col] !== 0) {
    return fillBoard(board, row, col + 1);
  }
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  shuffle(nums);
  for (let num of nums) {
    if (isSafe(board, row, col, num)) {
      board[row][col] = num;
      if (fillBoard(board, row, col + 1)) return true;
      board[row][col] = 0;
    }
  }
  return false;
}

// Prüft, ob 'num' in board[row][col] eingesetzt werden kann
function isSafe(board, row, col, num) {
  for (let x = 0; x < N; x++) {
    if (board[row][x] === num) return false;
  }
  for (let x = 0; x < N; x++) {
    if (board[x][col] === num) return false;
  }
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[startRow + i][startCol + j] === num) return false;
    }
  }
  return true;
}

// Mischet ein Array basierend auf unserem Seed
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Entfernt eine festgelegte Anzahl von Zellen (setzt diese auf 0)
function removeCells(board) {
  let cellsToRemove = 40; // Schwierigkeitsgrad anpassbar
  while (cellsToRemove > 0) {
    const i = Math.floor(rand() * N);
    const j = Math.floor(rand() * N);
    if (board[i][j] !== 0) {
      board[i][j] = 0;
      cellsToRemove--;
    }
  }
}

// Generiere ein vollständiges Sudoku und entferne Zellen
function generateSudoku() {
  fillBoard(board);
  removeCells(board);
}

// Beim Laden: Prüfe, ob ein Puzzle vom aktuellen Tag im localStorage gespeichert ist
if (localStorage.getItem("sudokuInitial") && localStorage.getItem("sudokuBoard")) {
  initialBoard = JSON.parse(localStorage.getItem("sudokuInitial"));
  board = JSON.parse(localStorage.getItem("sudokuBoard"));
  // Wenn bereits ein Spielstand existiert, den Timer sofort starten:
  if (!timerRunning) {
    startTimer();
  }
} else {
  generateSudoku();
  initialBoard = board.map(row => row.slice());
  localStorage.setItem("sudokuInitial", JSON.stringify(initialBoard));
  localStorage.setItem("sudokuBoard", JSON.stringify(board));
}

/***** Rendering des Boards *****/
function renderBoard() {
  const container = document.getElementById('sudoku-container');
  container.innerHTML = '';
  document.getElementById('message').textContent = '';
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.setAttribute("data-row", i);
      cell.setAttribute("data-col", j);

      // Dickere Ränder zur Trennung der 3x3 Blöcke
      cell.style.borderTop = (i % 3 === 0) ? '2px solid #fff' : '1px solid #555';
      cell.style.borderLeft = (j % 3 === 0) ? '2px solid #fff' : '1px solid #555';
      cell.style.borderRight = ((j + 1) % 3 === 0) ? '2px solid #fff' : '1px solid #555';
      cell.style.borderBottom = ((i + 1) % 3 === 0) ? '2px solid #fff' : '1px solid #555';
      
      // Unterscheide zwischen vorgegebenen Zahlen und Spieler-Eingaben
      if (initialBoard[i][j] !== 0) {
        cell.textContent = board[i][j];
        cell.setAttribute('data-fixed', 'true');
      } else {
        cell.textContent = board[i][j] !== 0 ? board[i][j] : '';
        cell.setAttribute("contenteditable", "true");
        cell.classList.add("editable");
        cell.addEventListener("input", function() {
          let text = cell.textContent;
          text = text.replace(/[^1-9]/g, '');
          if (text.length > 1) {
            text = text.slice(0, 1);
          }
          cell.textContent = text;
          if (!timerRunning && text !== "") {
            startTimer();
          }
          const row = parseInt(cell.getAttribute("data-row"), 10);
          const col = parseInt(cell.getAttribute("data-col"), 10);
          board[row][col] = text ? parseInt(text, 10) : 0;
          localStorage.setItem("sudokuBoard", JSON.stringify(board));
        });
        cell.addEventListener("focus", function() {
          cell.textContent = '';
        });
      }
      container.appendChild(cell);
    }
  }
}

renderBoard();

/***** Validierung & Score speichern *****/
function isValidSolution() {
  const cells = document.querySelectorAll('.cell');
  let grid = [];

  for (let i = 0; i < 9; i++) {
    grid[i] = [];
    for (let j = 0; j < 9; j++) {
      const cellIndex = i * 9 + j;
      let value = parseInt(cells[cellIndex].textContent.trim());
      if (!value || value < 1 || value > 9) return false;
      grid[i][j] = value;
    }
  }

  for (let i = 0; i < 9; i++) {
    let rowSet = new Set();
    let colSet = new Set();
    for (let j = 0; j < 9; j++) {
      if (rowSet.has(grid[i][j])) return false;
      rowSet.add(grid[i][j]);
      if (colSet.has(grid[j][i])) return false;
      colSet.add(grid[j][i]);
    }
  }

  for (let blockRow = 0; blockRow < 3; blockRow++) {
    for (let blockCol = 0; blockCol < 3; blockCol++) {
      let blockSet = new Set();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          let cellValue = grid[blockRow * 3 + i][blockCol * 3 + j];
          if (blockSet.has(cellValue)) return false;
          blockSet.add(cellValue);
        }
      }
    }
  }
  return true;
}

// Speichert den Score per HTTP-Anfrage
async function saveScore(score) {
  const player = localStorage.getItem("currentUser") || "Guest";
  const apiUrl = "https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec";
  const sheetName = "Daily-Sudoku";
  const url = `${apiUrl}?sheetName=${encodeURIComponent(sheetName)}&player=${encodeURIComponent(player)}&score=${encodeURIComponent(score)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Fehler! Status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Score erfolgreich gespeichert:", data);
  } catch (error) {
    console.error("Fehler beim Speichern des Scores:", error);
  }
}

document.getElementById('checkButton').addEventListener('click', function() {
  if (isValidSolution()) {
    pauseTimer();
    const score = Math.floor((accumulatedTime) / 1000);
    saveScore(score);
    document.getElementById('message').innerHTML = "Herzlichen Glückwunsch, korrekt gelöst!<br>Schau morgen gerne wieder vorbei";
  } else {
    document.getElementById('message').textContent = "Die Lösung ist falsch.";
  }
});

// Reset: Nur den Spielfortschritt (board) zurücksetzen, Timer bleibt unverändert
document.getElementById('resetButton').addEventListener('click', function() {
  board = initialBoard.map(row => row.slice());
  localStorage.setItem("sudokuBoard", JSON.stringify(board));
  renderBoard();
});

/***** Modal-Handling *****/
document.getElementById("info-icon").addEventListener("click", function(){
  document.getElementById("info-modal").style.display = "block";
});

document.getElementsByClassName("close")[0].addEventListener("click", function(){
  document.getElementById("info-modal").style.display = "none";
});

window.addEventListener("click", function(event){
  if(event.target == document.getElementById("info-modal")){
    document.getElementById("info-modal").style.display = "none";
  }
});

window.addEventListener("beforeunload", function() {
  pauseTimer();
});

/***** Zoom-Funktionalität *****/
let zoomedIn = false;
document.getElementById("zoom-icon").addEventListener("click", function() {
  const gameArea = document.getElementById("game-area");
  if (!zoomedIn) {
    gameArea.style.transform = "scale(1.5)";
    zoomedIn = true;
    // Zeige Overlay-Nachricht für 2 Sekunden
    const zoomMessage = document.getElementById("zoom-message");
    zoomMessage.style.display = "block";
    setTimeout(function() {
      zoomMessage.style.display = "none";
    }, 2000);
  } else {
    gameArea.style.transform = "scale(1)";
    zoomedIn = false;
  }
});
