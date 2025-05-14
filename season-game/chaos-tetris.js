const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 640,
  pixelArt: true,
  backgroundColor: '#111',
  scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// Spielfeld-Konstanten
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 32;
let dropInterval = 500; // Initiales Fallintervall (wird dynamisch angepasst)

// Geschwindigkeitsmuster im Chaos-Modus: beliebig erweiterbar
const speedPattern = [500, 350, 150, 650, 400, 200, 300, 100];

// Globale Variablen
let board, currentPiece, nextPiece;
let score = 0;
let scoreText, nextText, gameOverText;
let graphics, previewGraphics, boardContainer;
// Tastatursteuerung über WASD:
let keyA, keyD, keyS, keyW;
let gameOver = false;

// Variable für den Lock Delay
let lockDelay = 150; // in Millisekunden
let lockDelayTimer = 0;

// Definition der Tetrominoes (inkl. Plus-Block, einer zusätzlichen T-Variante, X-Block und U-Block)
const tetrominoes = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  "+": [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0]
  ],
  T2: [
    [1, 1, 1],
    [0, 1, 0],
    [0, 1, 0]
  ],
  X: [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ],
  U: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1]
  ]
};

// Farben der Tetrominoes
const colors = {
  I: 0x00ffff,
  J: 0x0000ff,
  L: 0xffa500,
  O: 0xffff00,
  S: 0x00ff00,
  T: 0xff00ff,
  Z: 0xff0000,
  "+": 0xffffff,
  T2: 0x8a2be2,
  X: 0xff69b4,
  U: 0x8fbc8f
};

function preload() {
  // Keine externen Assets – direktes Zeichnen
}

function create() {
  // Spielvariablen zurücksetzen
  score = 0;
  gameOver = false;

  // Spielfeld initialisieren
  board = [];
  for (let y = 0; y < ROWS; y++) {
    board[y] = [];
    for (let x = 0; x < COLS; x++) {
      board[y][x] = 0;
    }
  }

  // Tastatursteuerung via WASD
  keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);

  // Graphics-Objekte für Spielfeld und Vorschau
  graphics = this.add.graphics();
  previewGraphics = this.add.graphics();
  
  // Packe das Spielfeld in einen Container, um Drehung zu ermöglichen
  boardContainer = this.add.container(0, 0);
  boardContainer.add(graphics);

  // Retro Pixel-Style Text
  const textStyle = { font: '16px "Press Start 2P"', fill: '#fff', stroke: '#000', strokeThickness: 2 };
  scoreText = this.add.text(330, 20, "Score: 0", textStyle);
  nextText = this.add.text(330, 80, "Nächstes:", textStyle);
  gameOverText = this.add.text(config.width / 2, config.height / 2, "", { font: '32px "Press Start 2P"', fill: '#fff', stroke: '#000', strokeThickness: 2 });
  gameOverText.setOrigin(0.5);

  // Erzeuge den ersten Block und die Vorschau
  spawnPiece();
}

function update(time, delta) {
  if (gameOver) return;

  // Berechne Fallgeschwindigkeit basierend auf dem aktuellen dropInterval
  const fallSpeed = BLOCK_SIZE / dropInterval;
  let effectiveDelta = delta;
  if (keyS.isDown) {
    effectiveDelta *= 5;
  }

  // Falllogik: Prüfen, ob ein weiterer Schritt möglich ist
  if (!isValidMove(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
    lockDelayTimer += delta;
    if (lockDelayTimer >= lockDelay) {
      currentPiece.fallOffset = 0;
      fixPiece();
      clearLines();
      spawnPiece();
      lockDelayTimer = 0;
    }
  } else {
    lockDelayTimer = 0;
    currentPiece.fallOffset += fallSpeed * effectiveDelta;
    while (currentPiece.fallOffset >= BLOCK_SIZE) {
      currentPiece.y++;
      currentPiece.fallOffset -= BLOCK_SIZE;
    }
  }

  // Steuerung: Normal oder invertiert alle 5000 Punkte
  const inverted = (Math.floor(score / 500) % 2 === 1);
  if (!inverted) {
    if (Phaser.Input.Keyboard.JustDown(keyA)) {
      if (isValidMove(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
        currentPiece.x--;
        lockDelayTimer = 0;
      }
    }
    if (Phaser.Input.Keyboard.JustDown(keyD)) {
      if (isValidMove(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
        currentPiece.x++;
        lockDelayTimer = 0;
      }
    }
    if (Phaser.Input.Keyboard.JustDown(keyW)) {
      rotatePiece();
    }
  } else {
    if (Phaser.Input.Keyboard.JustDown(keyA)) {
      if (isValidMove(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
        currentPiece.x++;
        lockDelayTimer = 0;
      }
    }
    if (Phaser.Input.Keyboard.JustDown(keyD)) {
      if (isValidMove(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
        currentPiece.x--;
        lockDelayTimer = 0;
      }
    }
    if (Phaser.Input.Keyboard.JustDown(keyW)) {
      rotatePieceInverse();
    }
  }

  // Aktualisiere die Drehung des Spielfeld-Containers
  if (inverted) {
    boardContainer.setPosition(320, 640);
    boardContainer.setRotation(Math.PI);
  } else {
    boardContainer.setPosition(0, 0);
    boardContainer.setRotation(0);
  }

  drawBoard();
  drawPreview();
}

function spawnPiece() {
  if (nextPiece) {
    currentPiece = {
      shape: nextPiece.shape,
      x: Math.floor(COLS / 2) - Math.floor(nextPiece.shape[0].length / 2),
      y: 0,
      fallOffset: 0,
      color: nextPiece.color
    };
  } else {
    const keys = Object.keys(tetrominoes);
    const rand = keys[Phaser.Math.Between(0, keys.length - 1)];
    currentPiece = {
      shape: tetrominoes[rand],
      x: Math.floor(COLS / 2) - Math.floor(tetrominoes[rand][0].length / 2),
      y: 0,
      fallOffset: 0,
      color: colors[rand]
    };
  }

  if (!isValidMove(currentPiece.shape, currentPiece.x, currentPiece.y)) {
    gameOver = true;
    gameOverText.setText("Game Over");
    saveScore(score);
    return;
  }

  const keys = Object.keys(tetrominoes);
  const rand = keys[Phaser.Math.Between(0, keys.length - 1)];
  nextPiece = {
    shape: tetrominoes[rand],
    color: colors[rand]
  };
}

function rotatePiece() {
  const rotated = rotateMatrix(currentPiece.shape);
  if (isValidMove(rotated, currentPiece.x, currentPiece.y)) {
    currentPiece.shape = rotated;
  }
}

function rotatePieceInverse() {
  const rotated = rotateMatrixCounter(currentPiece.shape);
  if (isValidMove(rotated, currentPiece.x, currentPiece.y)) {
    currentPiece.shape = rotated;
  }
}

function rotateMatrix(matrix) {
  const N = matrix.length;
  let result = [];
  for (let i = 0; i < N; i++) {
    result[i] = [];
    for (let j = 0; j < N; j++) {
      result[i][j] = matrix[N - j - 1][i];
    }
  }
  return result;
}

function rotateMatrixCounter(matrix) {
  const N = matrix.length;
  let result = [];
  for (let i = 0; i < N; i++) {
    result[i] = [];
    for (let j = 0; j < N; j++) {
      result[i][j] = matrix[j][N - i - 1];
    }
  }
  return result;
}

function isValidMove(shape, posX, posY) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const newX = posX + x;
        const newY = posY + y;
        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return false;
        }
        if (newY >= 0 && board[newY][newX] !== 0) {
          return false;
        }
      }
    }
  }
  return true;
}

function fixPiece() {
  const shape = currentPiece.shape;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const boardX = currentPiece.x + x;
        const boardY = currentPiece.y + y;
        if (boardY >= 0) {
          board[boardY][boardX] = currentPiece.color;
        }
      }
    }
  }
}

function clearLines() {
  let linesCleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    let full = true;
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(0));
      linesCleared++;
      y++;
    }
  }
  if (linesCleared > 0) {
    let points = linesCleared * 100;
    if (linesCleared === 2) {
      points += 50;
    } else if (linesCleared === 3) {
      points += 150;
    } else if (linesCleared >= 4) {
      points += 300;
    }
    score += points;
    scoreText.setText("Score: " + score);
    updateDropInterval();
  }
}

function updateDropInterval() {
  let cycle = Math.floor(score / 500);
  dropInterval = speedPattern[cycle % speedPattern.length];
}

function drawBoard() {
  graphics.clear();
  
  graphics.fillStyle(0x111111, 1);
  graphics.fillRect(0, 0, 320, 640);

  // Zeichne den Board-Inhalt
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== 0) {
        graphics.fillStyle(board[y][x], 1);
        graphics.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      }
    }
  }

  // Zeichne das aktuelle Piece
  const shape = currentPiece.shape;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        graphics.fillStyle(currentPiece.color, 1);
        graphics.fillRect(
          (currentPiece.x + x) * BLOCK_SIZE,
          currentPiece.y * BLOCK_SIZE + currentPiece.fallOffset + y * BLOCK_SIZE,
          BLOCK_SIZE - 1,
          BLOCK_SIZE - 1
        );
      }
    }
  }
}

function drawPreview() {
  previewGraphics.clear();
  previewGraphics.fillStyle(0x222222, 1);
  previewGraphics.fillRect(320, 0, 160, 640);

  let previewAreaX = 340;
  let previewAreaY = 120;
  let shape = nextPiece.shape;
  let shapeWidth = shape[0].length;
  let shapeHeight = shape.length;
  let offsetX = previewAreaX + ((4 - shapeWidth) * BLOCK_SIZE) / 2;
  let offsetY = previewAreaY + ((4 - shapeHeight) * BLOCK_SIZE) / 2;

  for (let y = 0; y < shapeHeight; y++) {
    for (let x = 0; x < shapeWidth; x++) {
      if (shape[y][x]) {
        previewGraphics.fillStyle(nextPiece.color, 1);
        previewGraphics.fillRect(offsetX + x * BLOCK_SIZE, offsetY + y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      }
    }
  }
}

async function saveScore(score) {
  const player = localStorage.getItem("currentUser") || "Guest";
  const apiUrl = "https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec";
  const sheetName = "season-highscore";
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

// Event-Listener für UI-Elemente

// Klick auf Restart-Button lädt die Seite neu (startet das Spiel neu)
document.getElementById("restartButton").addEventListener("click", () => {
  location.reload();
});

// Back-Dot: Hole den aktuellen User aus dem Local Storage und setze ihn als Tooltip
const currentUser = localStorage.getItem("currentUser");
const backButton = document.getElementById("backButton");
if (currentUser) {
  backButton.title = "User: " + currentUser;
}
// Klick auf den roten Dot führt zurück zu index.html
backButton.addEventListener("click", () => {
  location.href = "../index.html";
});

// Öffnet das Modal beim Klicken auf das Info-Icon
document.getElementById("info-icon").addEventListener("click", function(){
  document.getElementById("info-modal").style.display = "block";
});

// Schließt das Modal beim Klicken auf das Schließen-Symbol
document.getElementsByClassName("close")[0].addEventListener("click", function(){
  document.getElementById("info-modal").style.display = "none";
});

// Schließt das Modal, wenn außerhalb des Modal-Contents geklickt wird
window.addEventListener("click", function(event){
  if(event.target == document.getElementById("info-modal")){
    document.getElementById("info-modal").style.display = "none";
  }
});
