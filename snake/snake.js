// UI-Elemente
const powerupDisplay = document.getElementById("powerupDisplay");
const scoreDisplay = document.getElementById("scoreDisplay");
const startButton = document.getElementById("startButton");
const backButton = document.getElementById("backButton");
const zoomIcon = document.getElementById("zoom-icon");
const zoomMessage = document.getElementById("zoom-message");
const gameUI = document.getElementById("game-ui");

// Phaser-Konfiguration
const config = {
  type: Phaser.AUTO,
  width: 400,
  height: 400,
  parent: "game-container",
  backgroundColor: "#2c2c2e",
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

// Spielvariablen
let snake = [];
let velocity = { x: 0, y: 0 };
let apple = null;
let wallPassPowerUp = null;
let shortenPowerUp = null;
let wallPassActive = false;
let wallPassEndTime = 0;
let nextPowerupSpawnTime = 0; // Für das gelbe Power-Up
let nextBluePowerupSpawnTime = 0; // Separater Timer für das blaue Power-Up
let activePowerupMessage = "";
let score = 0;
let gameRunning = false;
let lastMoveTime = 0;
let moveDelay = 150; // Basis-Geschwindigkeit in ms
const gridSize = 20;
const tileCount = 400 / gridSize;
const baseSpeed = 150;
const acceleration = 2;
const minSpeed = 50;

let graphics;
let wasdKeys;

// Zoom Zustand
let zoomActive = false;

function preload() {
  // Es werden keine externen Assets geladen – alles wird per Graphics gezeichnet.
}

function create() {
  graphics = this.add.graphics();
  // WASD-Steuerung
  wasdKeys = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D
  });
  // Das Spiel startet NICHT automatisch – über den Start-Button.
}

// Neue Funktion zur Richtungsänderung, die 180°-Drehungen verhindert
function changeDirection(newDirection) {
  if (snake.length > 1 && (velocity.x + newDirection.x === 0 && velocity.y + newDirection.y === 0)) {
    return; // 180°-Drehung ignorieren
  }
  velocity = newDirection;
}

function startGame() {
  snake = [{ x: 10, y: 10 }];
  velocity = { x: 1, y: 0 }; // Schlange startet nach rechts
  apple = randomPosition();
  wallPassPowerUp = null;
  shortenPowerUp = null;
  wallPassActive = false;
  wallPassEndTime = 0;
  nextPowerupSpawnTime = 0;
  nextBluePowerupSpawnTime = 0;
  activePowerupMessage = "";
  score = 0;
  gameRunning = true;
  lastMoveTime = 0;
  moveDelay = baseSpeed;
  updateUIText();
}

function update(time, delta) {
  if (!gameRunning) return;

  // Steuerung via WASD über changeDirection-Funktion
  if (wasdKeys.up.isDown) {
    changeDirection({ x: 0, y: -1 });
  } else if (wasdKeys.down.isDown) {
    changeDirection({ x: 0, y: 1 });
  } else if (wasdKeys.left.isDown) {
    changeDirection({ x: -1, y: 0 });
  } else if (wasdKeys.right.isDown) {
    changeDirection({ x: 1, y: 0 });
  }

  if (time - lastMoveTime > moveDelay) {
    moveSnake();
    lastMoveTime = time;
    moveDelay = Math.max(minSpeed, baseSpeed - score * acceleration);
  }

  updatePowerupTimers();
  drawScene();
  updateUIText();
}

function moveSnake() {
  const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

  // Wandkollision prüfen
  if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
    if (!wallPassActive) {
      gameOver();
      return;
    } else {
      // Wrap-Around wenn Wall Pass aktiv
      if (head.x < 0) head.x = tileCount - 1;
      if (head.x >= tileCount) head.x = 0;
      if (head.y < 0) head.y = tileCount - 1;
      if (head.y >= tileCount) head.y = 0;
    }
  }

  // Selbstkollision prüfen
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      gameOver();
      return;
    }
  }

  snake.unshift(head);

  // Apfel essen?
  if (head.x === apple.x && head.y === apple.y) {
    score++;
    apple = randomPosition();
  } else {
    snake.pop();
  }

  // Blaues Power-Up: Wall Pass
  if (wallPassPowerUp && head.x === wallPassPowerUp.x && head.y === wallPassPowerUp.y) {
    wallPassActive = true;
    wallPassEndTime = Date.now() + 20000; // 20 Sekunden aktiv
    wallPassPowerUp = null;
    nextBluePowerupSpawnTime = Date.now() + 90000; // 90 Sekunden Cooldown
    activePowerupMessage = "Wall Pass aktiv (20 s)";
  }

  // Gelbes Power-Up: Schlange verkürzen (nur wenn Score >= 20)
  if (shortenPowerUp && head.x === shortenPowerUp.x && head.y === shortenPowerUp.y) {
    if (score >= 20) {
      let removeCount = Math.min(3, snake.length - 1);
      for (let i = 0; i < removeCount; i++) {
        snake.pop();
      }
      shortenPowerUp = null;
      nextPowerupSpawnTime = Date.now() + 30000;
      activePowerupMessage = "Snake verkürzt!";
      setTimeout(() => {
        if (!wallPassActive) {
          activePowerupMessage = "";
          updateUIText();
        }
      }, 5000);
    }
  }
}

function updatePowerupTimers() {
  if (wallPassActive) {
    let remaining = Math.ceil((wallPassEndTime - Date.now()) / 1000);
    if (remaining <= 0) {
      wallPassActive = false;
      activePowerupMessage = "";
    } else {
      activePowerupMessage = "Wall Pass aktiv (" + remaining + " s)";
    }
  }

  // Blaues Power-Up spawnen, wenn Cooldown abgelaufen
  if (Date.now() > nextBluePowerupSpawnTime) {
    if (!wallPassPowerUp && Math.random() < 0.01) {
      wallPassPowerUp = randomPosition();
    }
  }

  // Gelbes Power-Up spawnen, wenn Cooldown abgelaufen und Score >= 20
  if (Date.now() > nextPowerupSpawnTime) {
    if (!shortenPowerUp && score >= 20 && Math.random() < 0.01) {
      shortenPowerUp = randomPosition();
    }
  }
}

function drawScene() {
  graphics.clear();

  // Raster zeichnen
  graphics.lineStyle(1, 0x3a3a3c);
  for (let x = 0; x <= 400; x += gridSize) {
    graphics.beginPath();
    graphics.moveTo(x, 0);
    graphics.lineTo(x, 400);
    graphics.strokePath();
  }
  for (let y = 0; y <= 400; y += gridSize) {
    graphics.beginPath();
    graphics.moveTo(0, y);
    graphics.lineTo(400, y);
    graphics.strokePath();
  }

  // Apfel zeichnen
  graphics.fillStyle(0xff3b30);
  graphics.fillRect(apple.x * gridSize, apple.y * gridSize, gridSize, gridSize);

  // Blaues Power-Up zeichnen
  if (wallPassPowerUp) {
    graphics.fillStyle(0x0a84ff);
    graphics.fillRect(wallPassPowerUp.x * gridSize, wallPassPowerUp.y * gridSize, gridSize, gridSize);
  }

  // Gelbes Power-Up zeichnen
  if (shortenPowerUp) {
    graphics.fillStyle(0xffcc00);
    graphics.fillRect(shortenPowerUp.x * gridSize, shortenPowerUp.y * gridSize, gridSize, gridSize);
  }

  // Schlange zeichnen
  graphics.fillStyle(0x32d74b);
  snake.forEach(segment => {
    graphics.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
  });

  // Rahmen-Effekt, wenn Wall Pass aktiv
  if (wallPassActive) {
    game.canvas.style.border = "2px solid #0a84ff";
    game.canvas.style.boxShadow = "0 0 10px #0a84ff";
  } else {
    game.canvas.style.border = "2px solid #444";
    game.canvas.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.7)";
  }
}

function randomPosition() {
  return {
    x: Phaser.Math.Between(0, tileCount - 1),
    y: Phaser.Math.Between(0, tileCount - 1)
  };
}

function updateUIText() {
  scoreDisplay.textContent = gameRunning ? "Score: " + score : "Game Over! Dein Score: " + score;
  powerupDisplay.textContent = activePowerupMessage;
}

async function saveScore(score) {
  const player = localStorage.getItem("currentUser") || "Guest";
  const apiUrl = "https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec";
  const sheetName = "snake";
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

function gameOver() {
  gameRunning = false;
  saveScore(score);
  activePowerupMessage = "";
  updateUIText();
}

// Event-Listener für den Start-Button
startButton.addEventListener("click", function() {
  if (!gameRunning) {
    startGame();
  }
});

// Klick auf den roten Dot führt zu index.html
backButton.addEventListener("click", () => {
  location.href = "../index.html";
});

// Öffnet das Modal beim Klick auf das Info-Icon
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

// Zoom-Funktionalität: Beim Klick auf den Zoom Icon ein-/ausschalten
zoomIcon.addEventListener("click", function() {
  zoomActive = !zoomActive;
  if (zoomActive) {
    gameUI.style.transform = "scale(1.5)";
    zoomMessage.style.display = "block";
    setTimeout(() => {
      zoomMessage.style.display = "none";
    }, 2000);
  } else {
    gameUI.style.transform = "scale(1)";
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