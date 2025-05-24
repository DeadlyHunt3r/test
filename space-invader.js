// 1) ─────────── Konstanten & UI-Elemente ───────────
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

// Zusätzliche UI-Elemente: Welle anzeigen
const waveDisplay = document.createElement('div');
waveDisplay.id = 'waveDisplay';
waveDisplay.style.color = '#fff';
waveDisplay.style.fontSize = '18px';
waveDisplay.style.marginBottom = '5px';
gameUI.insertBefore(waveDisplay, gameUI.firstChild);

// Feste Spielfeld-Größe (logisch)
const size = 600; // immer 600x600 Spielfläche

let gameRunning = false;
let score = 0, lives = 3, wave = 0;
let waveCleared = false;

const maxLives = 3;
const maxWaves = 100000;
const powerDuration = 10000;
const invaderBaseSpeed = 30;
const powerTypes = ['powerShield', 'powerRapid', 'powerBomb'];

let shieldActive = false, rapidActive = false;
let shieldEnd = 0, rapidEnd = 0;

// Invulnerability nach Treffer
let invulnerable = false;
let invulnerableEnd = 0;
const invulDuration = 1500; // ms

// Phaser-Objekte
let player, cursors;
let shots, invaders, enemyShots, powerups;
let playerCircle;
let rapidIcon, rapidTween;

// 2) ─────────── Helper-Funktionen ───────────
function updateUI() {
  scoreDisplay.textContent = 'Score: ' + score;
  livesDisplay.innerHTML = '';
  if (shieldActive) {
    for (let i = 0; i < lives; i++) livesDisplay.innerHTML += '<span class="heart">💙</span>';
    for (let i = lives; i < maxLives; i++) livesDisplay.innerHTML += '<span class="heart">🤍</span>';
  } else {
    for (let i = 0; i < lives; i++) livesDisplay.innerHTML += '<span class="heart">❤️</span>';
    for (let i = lives; i < maxLives; i++) livesDisplay.innerHTML += '<span class="heart">🤍</span>';
  }
  waveDisplay.textContent = 'Welle: ' + wave;
}

function schedulePowerup(scene) {
  scene.time.addEvent({
    delay: Phaser.Math.Between(20000, 40000),
    callback: () => {
      if (gameRunning && powerups.countActive(true) < 2) {
        const type = Phaser.Utils.Array.GetRandom(powerTypes);
        const emoji = { powerShield: '💙', powerRapid: '⚡', powerBomb: '💣' }[type];
        const x = Phaser.Math.Between(30, size - 30);
        const pu = scene.add.text(x, 30, emoji, { fontSize: '32px' }).setOrigin(0.5);
        powerups.add(pu);
        pu.setData('type', type);
      }
      schedulePowerup(scene);
    },
    loop: false
  });
}

// 3) ─────────── saveScore-Funktion für Highscore ───────────
async function saveScore(score) {
  const playerName = localStorage.getItem("currentUser") || "Guest";
  const apiUrl = "https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec";
  const sheetName = "season 2";
  const url = `${apiUrl}?sheetName=${encodeURIComponent(sheetName)}&player=${encodeURIComponent(playerName)}&score=${encodeURIComponent(score)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Fehler! Status: ${response.status}`);
    console.log("Score erfolgreich gespeichert:", await response.json());
  } catch (error) {
    console.error("Fehler beim Speichern des Scores:", error);
  }
}

// 4) ─────────── Phaser-Scene-Funktionen ───────────
function preload() {
  this.load.image('player', 'assets/media/tiny_ship20.png');
  this.load.image('invader', 'assets/media/tiny_ship16.png');
  let g = this.make.graphics({ add: false });
  g.fillStyle(0x39FF14); g.fillRect(0, 0, 4, 12); g.generateTexture('shot', 4, 12); g.clear();
  g.fillStyle(0xff0000); g.fillRect(0, 0, 4, 12); g.generateTexture('enemyShot', 4, 12); g.clear();
  g.fillStyle(0x00ffdd); g.fillCircle(10, 10, 10); g.generateTexture('powerShield', 20, 20); g.clear();
  g.fillStyle(0xffff00); g.fillRect(0, 0, 20, 20); g.generateTexture('powerRapid', 20, 20); g.clear();
  g.fillStyle(0xff00ff); g.fillTriangle(0, 20, 10, 0, 20, 20); g.generateTexture('powerBomb', 20, 20); g.clear();
}

function create() {
  player = this.physics.add.sprite(size / 2, size - 40, 'player');
  player.setCollideWorldBounds(true);
  shots        = this.physics.add.group();
  enemyShots   = this.physics.add.group();
  invaders     = this.physics.add.group();
  powerups     = this.physics.add.group();
  cursors      = this.input.keyboard.createCursorKeys();
  keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  this.physics.add.overlap(shots, invaders, destroyInvader, null, this);
  this.physics.add.overlap(player, enemyShots, playerHit, null, this);
  this.physics.add.overlap(player, powerups, collectPowerup, null, this);
  schedulePowerup(this);
  updateUI();
}

function update(time, delta) {
  if (!gameRunning) return;
  const now = Date.now();
  // Invulnerability beenden
  if (invulnerable && now > invulnerableEnd) {
    invulnerable = false;
    player.clearTint();
    player.setAlpha(1);
  }

  player.setVelocityX(0);
  if (cursors.left.isDown || keyA.isDown)  player.setVelocityX(-200);
  if (cursors.right.isDown|| keyD.isDown) player.setVelocityX(200);
  if (cursors.space.isDown && (!player.lastShot || time - player.lastShot > (rapidActive ? 450 : 600))) {
    const shot = shots.create(player.x, player.y - 20, 'shot');
    shot.setVelocityY(-300);
    player.lastShot = time;
  }

  invaders.children.iterate(inv => {
    if (!inv.body) return;
    if ((inv.x <= 16 && inv.getData('dir') === -1) ||
        (inv.x >= size - 16 && inv.getData('dir') === 1)) {
      inv.setData('dir', -inv.getData('dir'));
      inv.y += 20;
    }
    inv.body.setVelocityX(inv.getData('dir') * (invaderBaseSpeed + wave * 2));
    if (Phaser.Math.FloatBetween(0, 1) < 0.001) {
      const e = enemyShots.create(inv.x, inv.y + 16, 'enemyShot');
      e.setVelocityY(150);
    }
  });

  if (invaders.countActive() > 0) waveCleared = true;
  else if (waveCleared) {
    waveCleared = false;
    if (wave < maxWaves) this.time.delayedCall(1000, () => spawnInvaders(this));
    else endGame();
  }

  if (shieldActive && now > shieldEnd) {
    shieldActive = false; player.clearTint(); updateUI();
  }
  if (rapidActive && now > rapidEnd) {
    rapidActive = false;
    if (rapidIcon) { rapidIcon.destroy(); rapidIcon = null; }
    if (rapidTween) { rapidTween.stop(); rapidTween = null; }
  }
  if (rapidActive && rapidIcon) rapidIcon.setPosition(player.x, player.y - 40);
  powerups.getChildren().forEach(pu => {
    pu.y += 80 * (delta / 1000);
    if (pu.y > size + 20) powerups.remove(pu, true, true);
  });
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
      const inv = scene.physics.add.sprite(x, y, 'invader').setOrigin(0.5);
      inv.body.setCollideWorldBounds(true);
      inv.setData('dir', 1);
      invaders.add(inv);
    }
  }
}

function destroyInvader(shot, inv) {
  shot.destroy(); inv.destroy(); score += 10; updateUI();
}

function playerHit(playerObj, shot) {
  // Schaden nur, wenn nicht unverwundbar
  if (invulnerable) return;
  shot.destroy();
  if (!shieldActive) {
    lives--; updateUI();
    if (lives <= 0) return endGame();
    // Invulnerabilität aktivieren
    invulnerable = true;
    invulnerableEnd = Date.now() + invulDuration;
    player.setTint(0xff0000);
    player.setAlpha(0.5);
  }
}

function collectPowerup(playerObj, pu) {
  const type = pu.getData('type'); powerups.remove(pu, true, true);
  const now = Date.now();
  if (type === 'powerShield') {
    shieldActive = true; shieldEnd = now + powerDuration; player.setTint(0x00ffdd); updateUI();
  } else if (type === 'powerRapid') {
    rapidActive = true; rapidEnd = now + powerDuration;
    if (rapidIcon) { rapidIcon.destroy(); rapidTween.stop(); }
    rapidIcon = this.add.text(player.x, player.y - 40, '⚡', { fontSize: '24px' }).setOrigin(0.5);
    rapidTween = this.tweens.add({ targets: rapidIcon, y: player.y - 50, duration: 500, yoyo: true, repeat: -1 });
  } else if (type === 'powerBomb') {
    const activeInv = invaders.getChildren().filter(i => i.active).slice(0, 5);
    activeInv.forEach(inv => {
      const bounds = inv.getBounds(); const offX = game.canvas.offsetLeft; const offY = game.canvas.offsetTop;
      const expl = document.createElement('div'); expl.textContent = '💥'; expl.style.position = 'absolute';
      expl.style.left = `${offX + bounds.centerX}px`;
      expl.style.top = `${offY + bounds.centerY}px`;
      expl.style.transform = 'translate(-50%, -50%)'; expl.style.fontSize = '32px'; expl.style.pointerEvents = 'none';
      gameUI.appendChild(expl);
      setTimeout(() => expl.remove(), 500);
      inv.destroy(); score += 10;
    }); updateUI();
  }
}

function startGame() {
  score = 0; lives = 3; wave = 0; waveCleared = false; gameRunning = true;
  invulnerable = false; player.clearTint(); player.setAlpha(1);
  shots.clear(true, true); enemyShots.clear(true, true); powerups.clear(true, true);
  spawnInvaders(game.scene.scenes[0]); startButton.style.display = 'none'; updateUI();
}

function endGame() {
  gameRunning = false; lives = 0; updateUI(); saveScore(score);
  shieldActive = false; rapidActive = false; invulnerable = false;
  player.clearTint(); player.setAlpha(1);
  if (rapidIcon) { rapidIcon.destroy(); rapidIcon = null; }
  if (rapidTween) { rapidTween.stop(); rapidTween = null; }
  powerups.clear(true, true); startButton.style.display = 'block';
}

startButton.addEventListener('click', startGame);
backButton.addEventListener('click', () => location.href = '../index.html');
zoomIcon.addEventListener('click', () => {
  const zoom = gameUI.style.transform !== 'scale(1.5)';
  gameUI.style.transform = zoom ? 'scale(1.5)' : 'scale(1)';
  zoomMessage.style.display = zoom ? 'block' : 'none'; setTimeout(() => zoomMessage.style.display = 'none', 2000);
});
infoIcon.addEventListener('click', () => infoModal.style.display = 'block');
closeModal.addEventListener('click', () => infoModal.style.display = 'none');
window.addEventListener('click', e => { if (e.target === infoModal) infoModal.style.display = 'none'; });

const config = {
  type: Phaser.AUTO, width: size, height: size, parent: 'game-container', transparent: true,
  scene: { preload, create, update }, physics: { default: 'arcade', arcade: { debug: false } }
};
const game = new Phaser.Game(config);
