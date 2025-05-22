// 1) ─────────── Konstanten & UI‑Elemente ───────────
const powerupDisplay = document.getElementById("powerupDisplay");
const scoreDisplay   = document.getElementById("scoreDisplay");
const livesDisplay   = document.getElementById("livesDisplay");
const startButton    = document.getElementById("startButton");
const backButton     = document.getElementById("backButton");
const zoomIcon       = document.getElementById("zoom-icon");
const zoomMessage    = document.getElementById("zoom-message");
const infoIcon       = document.getElementById("info-icon");
const infoModal      = document.getElementById("info-modal");
const closeModal     = document.getElementsByClassName("close")[0];
const gameUI         = document.getElementById("game-ui");

// Zusätzliche UI-Elemente
const waveDisplay = document.createElement('div');
waveDisplay.id = 'waveDisplay';
waveDisplay.style.color = '#fff';
waveDisplay.style.fontSize = '18px';
waveDisplay.style.marginBottom = '5px';
gameUI.insertBefore(waveDisplay, gameUI.firstChild);

const powerTimerDisplay = document.createElement('div');
powerTimerDisplay.id = 'powerTimerDisplay';
powerTimerDisplay.style.color = '#fff';
powerTimerDisplay.style.fontSize = '18px';
powerTimerDisplay.style.marginBottom = '5px';
gameUI.insertBefore(powerTimerDisplay, gameUI.firstChild);

const gameOverMsg = document.createElement('div');
gameOverMsg.id = 'gameOverMsg';
gameOverMsg.textContent = 'Game Over';
gameOverMsg.style.position = 'absolute';
gameOverMsg.style.top = '50%';
gameOverMsg.style.left = '50%';
gameOverMsg.style.transform = 'translate(-50%, -50%)';
gameOverMsg.style.fontSize = '48px';
gameOverMsg.style.color = 'red';
gameOverMsg.style.display = 'none';
gameUI.appendChild(gameOverMsg);

// Spiel‑Variablen
const gridSize = 32;
let size = Math.min(window.innerWidth, window.innerHeight) * 0.8;
size -= size % gridSize;

let gameRunning = false;
let score = 0, lives = 3, wave = 0;
let waveCleared = false;

const maxLives = 3;
const maxWaves = 5;
const powerDuration = 10000;
const invaderBaseSpeed = 30;
const powerTypes = ['powerShield','powerRapid','powerBomb'];

let shieldActive = false, rapidActive = false, bombActive = false;
let shieldEnd = 0, rapidEnd = 0;

// Phaser‑Objekte
let player, cursors;
let shots, invaders, enemyShots, powerups;

// 2) ─────────── Helper‑Funktionen ───────────
function updateUI() {
  scoreDisplay.textContent = 'Score: ' + score;
  livesDisplay.innerHTML = '';
  for (let i = 0; i < lives; i++) livesDisplay.innerHTML += '<span class="heart">❤️</span>';
  for (let i = lives; i < maxLives; i++) livesDisplay.innerHTML += '<span class="heart">🤍</span>';
  waveDisplay.textContent = 'Welle: ' + wave;

  const now = Date.now();
  if (shieldActive || rapidActive || bombActive) {
    let emoji = bombActive ? '💣' : shieldActive ? '🩵' : '⚡';
    let rem   = shieldActive ? shieldEnd - now
               : rapidActive  ? rapidEnd  - now
               : 0;
    const secs = Math.max(0, Math.ceil(rem / 1000));
    powerTimerDisplay.textContent = 'PowerUp: ' + emoji + ' (' + secs + 's)';
  } else {
    powerTimerDisplay.textContent = '';
  }
}

function spawnInvaders(scene) {
  invaders.clear(true, true);
  wave++;
  const rows = 2 + Math.floor(wave / 3);
  const cols = 6 + Math.floor(wave / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 60 + c * (size - 120) / (cols - 1);
      const y = 60 + r * 40;
      const inv = scene.add.text(x, y, '👾', { fontSize: '32px' }).setOrigin(0.5);
      scene.physics.world.enable(inv);
      inv.body.setCollideWorldBounds(true);
      inv.setData('dir', 1);
      invaders.add(inv);
    }
  }
}

function schedulePowerup(scene) {
  const delay = Phaser.Math.Between(5000, 10000);
  scene.time.addEvent({
    delay,
    callback: () => {
      if (gameRunning && powerups.countActive(true) < 2) {
        const pick  = Phaser.Utils.Array.GetRandom(powerTypes);
        const emoji = pick === 'powerShield' ? '🩵' : pick === 'powerRapid' ? '⚡' : '💣';
        const x = Phaser.Math.Between(30, size - 30);
        const pu = scene.add.text(x, 30, emoji, { fontSize: '32px' }).setOrigin(0.5);
        powerups.add(pu);
        pu.setData('type', pick);
      }
      schedulePowerup(scene);
    }
  });
}

function destroyInvader(shot, inv) { 
  shot.destroy(); 
  inv.destroy(); 
  score += 10; 
}

function playerHit(playerObj, shot) {
  shot.destroy();
  if (!shieldActive) {
    lives--;
    if (lives <= 0) endGame();
  }
}

function collectPowerup(playerObj, pu) {
  const type = pu.getData('type');
  powerups.remove(pu, true, true);

  const now = Date.now();
  if (type === 'powerShield') {
    shieldActive = true;
    shieldEnd = now + powerDuration;
    player.setTint(0x00ffdd);
  } else if (type === 'powerRapid') {
    rapidActive = true;
    rapidEnd = now + powerDuration;
  } else if (type === 'powerBomb') {
    bombActive = true;
  }
}

// 3) ─────────── Phaser‑Scene‑Funktionen ───────────
function preload() {
  this.load.image('space', 'assets/media/space-background.png'); // Hintergrund

  let g = this.make.graphics({ add: false });
  g.fillStyle(0xffffff); g.fillRect(0,0,40,20); g.generateTexture('player',40,20); g.clear();
  g.fillStyle(0xffffff); g.fillRect(0,0,4,12);  g.generateTexture('shot',4,12);   g.clear();
  g.fillStyle(0x00ff00); g.fillCircle(16,16,16); g.generateTexture('invader',32,32); g.clear();
  g.fillStyle(0xff0000); g.fillRect(0,0,4,12);  g.generateTexture('enemyShot',4,12); g.clear();
  g.fillStyle(0x00ffdd); g.fillCircle(10,10,10); g.generateTexture('powerShield',20,20); g.clear();
  g.fillStyle(0xffff00); g.fillRect(0,0,20,20); g.generateTexture('powerRapid',20,20);  g.clear();
  g.fillStyle(0xff00ff); g.fillTriangle(0,20,10,0,20,20); g.generateTexture('powerBomb',20,20); g.clear();
}

function create() {
  this.add.image(size / 2, size / 2, 'space').setDisplaySize(size, size); // Hintergrund einfügen

  player = this.physics.add.sprite(size/2, size - 40, 'player');
  player.setCollideWorldBounds(true);

  shots      = this.physics.add.group();
  enemyShots = this.physics.add.group();
  invaders   = this.physics.add.group();
  powerups   = this.physics.add.group();

  cursors = this.input.keyboard.createCursorKeys();

  this.physics.add.overlap(shots, invaders, destroyInvader, null, this);
  this.physics.add.overlap(player, enemyShots, playerHit, null, this);
  this.physics.add.overlap(player, powerups, collectPowerup, null, this);

  schedulePowerup(this);
  updateUI();
}

function update(time, delta) {
  if (!gameRunning) return;

  player.setVelocityX(0);
  if (cursors.left.isDown)  player.setVelocityX(-200);
  if (cursors.right.isDown) player.setVelocityX(200);
  if (cursors.space.isDown && (!player.lastShot || time - player.lastShot > (rapidActive ? 250 : 600))) {
    const shot = shots.create(player.x, player.y - 20, 'shot');
    shot.setVelocityY(-300);
    player.lastShot = time;

    if (bombActive) {
      invaders.children.iterate(inv => {
        if (inv.active) {
          inv.destroy();
          score += 10;
        }
      });
      bombActive = false;
    }
  }

  invaders.children.iterate(inv => {
    if (!inv || !inv.body) return;

    if ((inv.x <= 16 && inv.getData('dir') === -1) || (inv.x >= size - 16 && inv.getData('dir') === 1)) {
      inv.setData('dir', -inv.getData('dir'));
      inv.y += 20;
    }

    inv.body.setVelocityX(inv.getData('dir') * (invaderBaseSpeed + wave * 2));

    if (Phaser.Math.FloatBetween(0, 1) < 0.001) {
      const e = enemyShots.create(inv.x, inv.y + 16, 'enemyShot');
      e.setVelocityY(150);
    }
  });

  if (invaders.countActive() > 0) {
    waveCleared = true;
  } else if (waveCleared) {
    waveCleared = false;
    if (wave < maxWaves) {
      this.time.delayedCall(1000, () => spawnInvaders(this));
    } else {
      endGame();
    }
  }

  const now = Date.now();
  if (shieldActive && now > shieldEnd) { shieldActive = false; player.clearTint(); }
  if (rapidActive && now > rapidEnd)   rapidActive = false;

  updateUI();

  powerups.getChildren().forEach(pu => {
    if (!pu) return;
    pu.y += 80 * (delta / 1000);
    if (pu.y > size + 20) {
      powerups.remove(pu, true, true);
    }
  });
}

// 4) ─────────── Spiel‑Kontrolle ───────────
function startGame() {
  score = 0;
  lives = 3;
  wave = 0;
  waveCleared = false;
  gameRunning = true;
  gameOverMsg.style.display = 'none';
  shots.clear(true, true);
  enemyShots.clear(true, true);
  powerups.clear(true, true);
  const scene = game.scene.scenes[0];
  spawnInvaders(scene);
  startButton.style.display = 'none';
}

function endGame() {
  gameRunning = false;
  lives = 0;
  updateUI();
  gameOverMsg.style.display = 'block';
  startButton.style.display = 'block';
}

// 5) ─────────── Event‑Listener ───────────
startButton.addEventListener('click', startGame);
backButton.addEventListener('click', () => location.href = 'index.html');
zoomIcon.addEventListener('click', () => {
  const zoomActive = gameUI.style.transform !== 'scale(1.5)';
  gameUI.style.transform = zoomActive ? 'scale(1.5)' : 'scale(1)';
  zoomMessage.style.display = zoomActive ? 'block' : 'none';
  setTimeout(() => zoomMessage.style.display = 'none', 2000);
});
infoIcon.addEventListener('click', () => infoModal.style.display = 'block');
closeModal.addEventListener('click', () => infoModal.style.display = 'none');
window.addEventListener('click', e => {
  if (e.target === infoModal) infoModal.style.display = 'none';
});

// 6) ─────────── Phaser‑Config & Game‑Instanz ───────────
const config = {
  type: Phaser.AUTO,
  width: size,
  height: size,
  parent: 'game-container',
  // backgroundColor: '#000000', // entfernt, damit Bild sichtbar ist
  scene: { preload, create, update },
  physics: { default: 'arcade', arcade: { debug: false } }
};

const game = new Phaser.Game(config);
