// Funktion zum Speichern des Scores per HTTP-Anfrage an Google Script
async function saveScore(score) {
  const player = localStorage.getItem("currentUser") || "Guest";
  const apiUrl = "https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec";
  // Wähle das Tabellenblatt je nach Spielfeldgröße:
  const sheetName = size === 6 ? "Phoenix-Fusion-Groß" : "Phoenix-Fusion-Normal";
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

let size = 4;
let board = [];
let isGameOver = false;
let score = 0;
let moveCount = 0;

const boardElement = document.getElementById('board');
const restartButton = document.getElementById('restart');
const toggleSizeButton = document.getElementById('toggle-size');
const statsElement = document.getElementById('stats');
const gameOverWindow = document.getElementById('game-over');
const gameOverRestart = document.getElementById('game-over-restart');

// Elemente für Einstellungen
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');

// Elemente für Steuerungsanpassung
const controlLeftInput = document.getElementById('control-left');
const controlRightInput = document.getElementById('control-right');
const controlUpInput = document.getElementById('control-up');
const controlDownInput = document.getElementById('control-down');

// Standardsteuerung – diese Werte werden anhand der Inputfelder aktualisiert.
let controls = {
  left: controlLeftInput.value.toLowerCase(),
  right: controlRightInput.value.toLowerCase(),
  up: controlUpInput.value.toLowerCase(),
  down: controlDownInput.value.toLowerCase()
};

// Update der Steuerung bei Änderung der Inputfelder
controlLeftInput.addEventListener('input', (e) => {
  controls.left = e.target.value.toLowerCase();
});
controlRightInput.addEventListener('input', (e) => {
  controls.right = e.target.value.toLowerCase();
});
controlUpInput.addEventListener('input', (e) => {
  controls.up = e.target.value.toLowerCase();
});
controlDownInput.addEventListener('input', (e) => {
  controls.down = e.target.value.toLowerCase();
});

function initGame() {
  board = Array.from({ length: size }, () => Array(size).fill(0));
  isGameOver = false;
  score = 0;
  moveCount = 0;
  spawnTile();
  spawnTile();
  renderBoard();
  updateStats();
  // Falls das Game-Over Fenster sichtbar war, wieder ausblenden
  gameOverWindow.style.display = 'none';
}

function renderBoard() {
  boardElement.innerHTML = '';
  boardElement.style.gridTemplateColumns = `repeat(${size}, 100px)`;
  boardElement.style.gridTemplateRows = `repeat(${size}, 100px)`;
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const cellValue = board[i][j];
      const cell = document.createElement('div');
      cell.classList.add('cell');
      if (cellValue > 0) {
        cell.textContent = cellValue;
        cell.classList.add(`cell-${cellValue}`);
      }
      boardElement.appendChild(cell);
    }
  }
}

// Versucht, einen neuen Block zu setzen.
// Gibt true zurück, wenn ein freies Feld gefunden wurde, sonst false.
function spawnTile() {
  let emptyCells = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j] === 0) emptyCells.push({ i, j });
    }
  }
  if (emptyCells.length === 0) return false;
  let { i, j } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[i][j] = Math.random() > 0.1 ? 2 : 4;
  return true;
}

// Aktualisiert die Statistik-Leiste
function updateStats() {
  let highestTile = 0;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i][j] > highestTile) highestTile = board[i][j];
    }
  }
  statsElement.innerText = `Score: ${score} | Moves: ${moveCount} | Höchste Kachel: ${highestTile}`;
}

// Verschiebt und kombiniert eine Zeile; beim Kombinieren wird der Score erhöht.
function slideAndCombine(row) {
  let filteredRow = row.filter(num => num !== 0);
  for (let i = 0; i < filteredRow.length - 1; i++) {
    if (filteredRow[i] === filteredRow[i + 1]) {
      filteredRow[i] *= 2;
      // Beim größeren Spielfeld (size = 6) wird nur ein Viertel des Punktwerts hinzugefügt
      if (size === 6) {
        score += filteredRow[i] / 4;
      } else {
        score += filteredRow[i];
      }
      filteredRow[i + 1] = 0;
      i++;
    }
  }
  filteredRow = filteredRow.filter(num => num !== 0);
  while (filteredRow.length < size) {
    filteredRow.push(0);
  }
  return filteredRow;
}

function moveLeft() {
  for (let i = 0; i < size; i++) {
    board[i] = slideAndCombine(board[i]);
  }
}

function moveRight() {
  for (let i = 0; i < size; i++) {
    let reversed = board[i].slice().reverse();
    board[i] = slideAndCombine(reversed).reverse();
  }
}

function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function moveUp() {
  board = transpose(board);
  moveLeft();
  board = transpose(board);
}

function moveDown() {
  board = transpose(board);
  moveRight();
  board = transpose(board);
}

// Führt eine Bewegung aus, setzt neuen Block und prüft Game Over.
function move(direction) {
  if (isGameOver) return;
  moveCount++;
  switch(direction) {
    case 'left':
      moveLeft();
      break;
    case 'right':
      moveRight();
      break;
    case 'up':
      moveUp();
      break;
    case 'down':
      moveDown();
      break;
  }
  let spawned = spawnTile();
  renderBoard();
  updateStats();
  if (!spawned) {
    isGameOver = true;
    showGameOver();
  }
  console.log(`Bewegung: ${direction}`);
}

// Zeigt Game-Over-Fenster und speichert den Score.
function showGameOver() {
  gameOverWindow.style.display = 'block';
  saveScore(score);
}

function toggleBoardSize() {
  size = size === 4 ? 6 : 4;
  initGame();
}

// Event Listener
restartButton.addEventListener('click', initGame);
toggleSizeButton.addEventListener('click', toggleBoardSize);
gameOverRestart.addEventListener('click', initGame);

// Tastatureingabe: Prüfe, ob gedrückte Taste der in den Einstellungen hinterlegten entspricht oder eine Pfeiltaste ist.
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === controls.left || key === 'arrowleft') move('left');
  else if (key === controls.right || key === 'arrowright') move('right');
  else if (key === controls.up || key === 'arrowup') move('up');
  else if (key === controls.down || key === 'arrowdown') move('down');
});

// Öffne oder schließe das Einstellungsfenster beim Klick auf das Zahnrad
settingsBtn.addEventListener('click', () => {
  settingsPanel.style.display = (settingsPanel.style.display === 'none' || settingsPanel.style.display === '') ? 'block' : 'none';
});

// Öffnet das Modal beim Klick auf das Info Icon
document.getElementById("info-icon").addEventListener("click", function(){
  document.getElementById("info-modal").style.display = "block";
});

// Schließt das Modal beim Klick auf das Schließen-Symbol
document.getElementsByClassName("close")[0].addEventListener("click", function(){
  document.getElementById("info-modal").style.display = "none";
});

// Schließt das Modal, wenn außerhalb des Modal-Contents geklickt wird
window.addEventListener("click", function(event){
  if(event.target == document.getElementById("info-modal")){
    document.getElementById("info-modal").style.display = "none";
  }
});

// Vollbild-Button Funktion
const fsIcon = document.getElementById('fullscreen-icon');
fsIcon.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Fehler beim Wechsel in den Vollbildmodus: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

initGame();
