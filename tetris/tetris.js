document.addEventListener("DOMContentLoaded", function() {
  // Phaser-Konfiguration
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
  let dropInterval = 500; // ms pro Zellen-Fall

  // Globale Variablen
  let board, currentPiece, nextPiece;
  let score = 0;
  let scoreText, nextText, gameOverText;
  let graphics, previewGraphics;
  let keyA, keyD, keyS, keyW;
  let gameOver = false;

  // Lock Delay (Verzögerung, bevor die Figur fixiert wird)
  let lockDelay = 150; // ms
  let lockDelayTimer = 0;

  // Tetromino-Definition als 2D-Arrays
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
    Z: 0xff0000
  };

  function preload() {
    // Keine externen Assets – alles wird gezeichnet
  }

  function create() {
    // Spielfeld initialisieren
    score = 0;
    gameOver = false;
    
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

    // Graphics-Objekte
    graphics = this.add.graphics();
    previewGraphics = this.add.graphics();

    // Text im Retro Pixel-Style
    const textStyle = { font: '16px "Press Start 2P"', fill: '#fff', stroke: '#000', strokeThickness: 2 };
    scoreText = this.add.text(330, 20, "Score: 0", textStyle);
    nextText = this.add.text(330, 80, "Nächstes:", textStyle);
    gameOverText = this.add.text(config.width / 2, config.height / 2, "", { font: '32px "Press Start 2P"', fill: '#fff', stroke: '#000', strokeThickness: 2 });
    gameOverText.setOrigin(0.5);

    // Starte das Spiel, indem der erste Tetromino erzeugt wird
    spawnPiece();
  }

  function update(time, delta) {
    if (gameOver) return;

    // Fallgeschwindigkeit anpassen (Drücken von S beschleunigt den Fall)
    const fallSpeed = BLOCK_SIZE / dropInterval;
    let effectiveDelta = delta;
    if (keyS.isDown) {
      effectiveDelta *= 5;
    }

    // Prüfen, ob Bewegung nach unten möglich ist
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

    // Links-/Rechts-Bewegung
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
    
    // Drehung
    if (Phaser.Input.Keyboard.JustDown(keyW)) {
      rotatePiece();
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
        y++; // Gleiche Zeile erneut prüfen
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
    let newInterval = 500 - Math.floor(score / 500) * 50;
    if (newInterval < 100) {
      newInterval = 100;
    }
    dropInterval = newInterval;
  }

  function drawBoard() {
    graphics.clear();
    graphics.fillStyle(0x111111, 1);
    graphics.fillRect(0, 0, 320, 640);
    
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x] !== 0) {
          graphics.fillStyle(board[y][x], 1);
          graphics.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }
      }
    }
    
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

  function updateUIText() {
    scoreText.setText("Score: " + score);
  }

  async function saveScore(score) {
    const player = localStorage.getItem("currentUser") || "Guest";
    const apiUrl = "https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec";
    const sheetName = "Tetris";
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

  // Restart-Funktionalität: Beim Klick auf den Restart-Button wird die Seite neu geladen
  document.getElementById("restartButton").addEventListener("click", () => {
    location.reload();
  });

  // Back-Dot: Zeigt ggf. den Usernamen an und navigiert zu index.html
  const currentUser = localStorage.getItem("currentUser");
  const backButton = document.getElementById("backButton");
  if (currentUser) {
    backButton.title = "User: " + currentUser;
  }
  backButton.addEventListener("click", () => {
    location.href = "../index.html";
  });

  // Modal-Handling: Info-Icon und Schließen-Button
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
});
