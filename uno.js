const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  parent: 'game-container',
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

let players = [];
let currentPlayer = 0;
let deck = [];          // Ziehstapel
let discardPile = [];   // Ablagestapel (gelegte Karten)
let currentCard;        // Aktuell aufgedeckte Karte (liegt auf dem Tisch)
let cardSprites = [];
let drawButton;
let scrollOffset = 0;

// Strafstapel für +2-Karten; wenn > 0 muss ein Spieler entweder eine +2 legen oder die angesammelte Strafmenge ziehen.
let plusTwoStack = 0;

const colors = ['rot', 'gelb', 'grün', 'blau'];
const numbers = ['0','1','2','3','4','5','6','7','8','9'];
// Positionen für das Spielfeld
const positions = [
  { x: 600, y: 700 }, // Spieler unten
  { x: 150, y: 100 }, // Bot 1 links oben
  { x: 600, y: 100 }, // Bot 2 rechts oben
  { x: 1050, y: 100 }  // Bot 3 Mitte oben
];
// DropZone in der Mitte des Spielfelds
const dropZone = { x: 600, y: 400, width: 160, height: 210 };

// Eigene Bot-Namen
const botNames = ["Siegfried", "Bob", "Hildegard"];

function preload() {
  // Zahlenkarten laden
  for (let color of colors) {
    for (let number of numbers) {
      let key = `${color}_${number}`;
      this.load.image(key, `assets/cards/${key}.png`);
    }
  }
  // Bilder für die +2-Karten laden
  for (let color of colors) {
    let key = `${color}_+2`;
    this.load.image(key, `assets/cards/${key}.png`);
  }
  // Profilbilder für die Bots
  this.load.image('botProfile1', 'assets/bot1.png');
  this.load.image('botProfile2', 'assets/bot2.png');
  this.load.image('botProfile3', 'assets/bot3.png');
}

function create() {
  this.children.removeAll();

  // Deck erstellen, mischen und austeilen, falls noch nicht vorhanden
  if (deck.length === 0) {
    deck = createDeck();
    Phaser.Utils.Array.Shuffle(deck);
    // Ziehe die Startkarte vom Ziehstapel
    currentCard = deck.pop();
    // Jeder Spieler erhält 7 Karten
    for (let i = 0; i < 4; i++) {
      players[i] = deck.splice(0, 7);
    }
  }

  drawCurrentCard(this);

  // Bot-Rahmen inkl. Profilbild, Namen und Kartenanzahl
  for (let i = 1; i < 4; i++) {
    this.add.rectangle(positions[i].x, positions[i].y, 220, 120, 0x444444)
      .setStrokeStyle(3, currentPlayer === i ? 0xffcc00 : 0xaaaaaa)
      .setName(`botFrame${i}`);
    this.add.image(positions[i].x, positions[i].y - 20, `botProfile${i}`)
      .setDisplaySize(40, 40);
    this.add.text(positions[i].x, positions[i].y + 10, botNames[i - 1], { fontSize: '18px', fill: '#eee' })
      .setOrigin(0.5);
    this.add.text(positions[i].x, positions[i].y + 30, 'Karten: ' + players[i].length, { fontSize: '16px', fill: '#eee' })
      .setOrigin(0.5)
      .setName(`botCount${i}`);
  }

  highlightActivePlayer(this);
  drawPlayerHand(this);

  if (currentPlayer === 0) {
    activatePlayerInput(this);
    createDrawButton(this);
  } else {
    deactivatePlayerInput(this);
  }

  // DropZone als transparenter Rahmen in der Mitte
  const dz = this.add.rectangle(dropZone.x, dropZone.y, dropZone.width, dropZone.height, 0xffffff, 0.1);
  dz.setStrokeStyle(3, 0xffffff);

  // Ermögliche horizontales Scrollen der Handkarten
  this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
    scrollOffset -= dy * 0.1;
    drawPlayerHand(this);
  });

  // Startet den Botzug, falls der aktuelle Spieler ein Bot ist
  if (currentPlayer !== 0) {
    this.time.delayedCall(2000, () => botTurn(this), [], this);
  }
}

function update() {}

// Erzeugt ein vollständiges Kartendeck (Zahlen + je 2x +2)
function createDeck() {
  let newDeck = [];
  for (let color of colors) {
    // Zahlenkarten
    for (let number of numbers) {
      newDeck.push({ color: color, value: number });
    }
    // Zwei +2-Karten pro Farbe
    newDeck.push({ color: color, value: '+2' });
    newDeck.push({ color: color, value: '+2' });
  }
  return newDeck;
}

// Zeichnet die aktuelle Karte in der DropZone
function drawCurrentCard(scene) {
  scene.children.list.filter(child => child.currentCard).forEach(child => child.destroy());
  let container = createCardContainer(scene, currentCard, dropZone.x, dropZone.y);
  container.currentCard = true;
}

// Zeichnet die Hand des Spielers
function drawPlayerHand(scene) {
  cardSprites.forEach(cs => cs.destroy());
  cardSprites = [];

  const hand = players[0];
  const startX = 350 + scrollOffset;
  const gap = 125;

  hand.forEach((card, index) => {
    let x = startX + index * gap;
    let y = positions[0].y;
    let cardContainer = createCardContainer(scene, card, x, y);
    cardContainer.originalX = x;
    cardContainer.originalY = y;
    cardContainer.setSize(120, 180);
    cardContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, 120, 180), Phaser.Geom.Rectangle.Contains);
    scene.input.setDraggable(cardContainer);
    cardContainer.card = card;
    cardSprites.push(cardContainer);
  });
}

// Erzeugt einen Container für eine Karte
function createCardContainer(scene, card, x, y) {
  let key = `${card.color}_${card.value}`;
  let sprite = scene.add.image(0, 0, key).setDisplaySize(120, 180);
  let container = scene.add.container(x, y, [sprite]);
  return container;
}

/* Spielregeln: Eine +2-Karte darf nur gespielt werden,
   wenn entweder die aktuelle Karte ebenfalls eine +2 ist oder die Farben übereinstimmen.
   Bei einem aktiven Strafstapel (plusTwoStack > 0) dürfen nur +2-Karten gespielt werden. */
function isPlayable(card) {
  if (plusTwoStack > 0) {
    if (card.value !== "+2") return false;
    return (currentCard.value === "+2" || card.color === currentCard.color);
  } else {
    if (card.value === "+2") {
      return (currentCard.value === "+2" || card.color === currentCard.color);
    } else {
      return (card.color === currentCard.color || card.value === currentCard.value);
    }
  }
}

function activatePlayerInput(scene) {
  cardSprites.forEach(cardContainer => {
    cardContainer.setInteractive();
    scene.input.setDraggable(cardContainer);
  });

  scene.input.on('dragstart', (pointer, gameObject) => {
    if (currentPlayer !== 0) return;
    gameObject.setScale(1.1);
  });
  scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
    if (currentPlayer !== 0) return;
    gameObject.x = dragX;
    gameObject.y = dragY;
  });
  scene.input.on('dragend', (pointer, gameObject) => {
    if (currentPlayer !== 0) return;
    gameObject.setScale(1);
    if (Phaser.Geom.Rectangle.ContainsPoint(
      new Phaser.Geom.Rectangle(dropZone.x - dropZone.width / 2, dropZone.y - dropZone.height / 2, dropZone.width, dropZone.height),
      { x: gameObject.x, y: gameObject.y }
    )) {
      if (isPlayable(gameObject.card)) {
        // Spieler legt Karte
        playPlayerCard(gameObject.card);
        gameObject.destroy();
        cardSprites = cardSprites.filter(cs => cs !== gameObject);
        removeDrawButton();
        nextTurn(scene);
        return;
      }
    }
    gameObject.x = gameObject.originalX;
    gameObject.y = gameObject.originalY;
  });
}

function deactivatePlayerInput(scene) {
  cardSprites.forEach(cardContainer => {
    cardContainer.disableInteractive();
  });
}

/* Erstellt den Draw-Button.
   Der Button-Text ändert sich, wenn Strafkarten gezogen werden müssen. */
function createDrawButton(scene) {
  let buttonText = plusTwoStack > 0 ? 'Strafkarten ziehen' : 'Karte ziehen';
  drawButton = scene.add.text(100, 550, buttonText, { fontSize: '24px', backgroundColor: '#3a3a3c', padding: { x: 12, y: 8 } })
    .setInteractive()
    .on('pointerdown', () => {
      if (plusTwoStack > 0) {
        // Sicherstellen, dass genug Karten vorhanden sind, um die Strafkarten zu ziehen
        ensureDeck(plusTwoStack);
        for (let i = 0; i < plusTwoStack; i++) {
          if (deck.length > 0) {
            players[0].push(deck.pop());
          }
        }
        plusTwoStack = 0;
      } else {
        ensureDeck(1);
        if (deck.length > 0) {
          let newCard = deck.pop();
          players[0].push(newCard);
        } else {
          console.log("Kein Zug möglich – deck ist leer!");
        }
      }
      removeDrawButton();
      nextTurn(scene);
    });
}

function removeDrawButton() {
  if (drawButton) {
    drawButton.destroy();
    drawButton = null;
  }
}

/* Wenn ein Spieler eine Karte legt, wird sie in den Ablagestapel verschoben.
   Spielt der Spieler eine +2, wird auch der Strafstapel erhöht. */
function playPlayerCard(card) {
  const index = players[0].findIndex(c => c.color === card.color && c.value === card.value);
  if (index !== -1) {
    players[0].splice(index, 1);
    currentCard = card;
    // Gelegte Karte in den Ablagestapel verschieben
    discardPile.push(card);
    if (card.value === "+2") {
      plusTwoStack += 2;
    }
    drawCurrentCard(game.scene.scenes[0]);
  }
}

// Hebt den aktiven Spieler hervor
function highlightActivePlayer(scene) {
  if (currentPlayer !== 0) {
    scene.add.rectangle(positions[0].x, positions[0].y, 260, 160)
      .setStrokeStyle(3, 0xffcc00, 0.3)
      .setDepth(-1)
      .setOrigin(0.5);
  }
}

/* Prüft, ob ein Spieler gewonnen hat; sonst wird zum nächsten Spieler gewechselt.
   Vor dem Ziehen von Karten wird mittels ensureDeck(count) überprüft, ob genügend Karten im Ziehstapel sind. */
function nextTurn(scene) {
  for (let i = 0; i < players.length; i++) {
    if (players[i].length === 0) {
      scene.add.text(500, 380, i === 0 ? 'Du hast gewonnen!' : botNames[i - 1] + ' hat gewonnen!', { fontSize: '32px', fill: '#0f0' });
      scene.add.text(500, 430, 'Neustarten', { fontSize: '28px', backgroundColor: '#3a3a3c', padding: { x: 12, y: 8 } })
        .setInteractive()
        .on('pointerdown', () => {
          deck = [];
          discardPile = [];
          players = [];
          currentPlayer = 0;
          plusTwoStack = 0;
          scene.scene.restart();
        });
      return;
    }
  }

  // Wechsle zum nächsten Spieler
  currentPlayer = (currentPlayer + 1) % 4;

  // Aktualisiere die UI bei den Bots
  for (let i = 1; i < 4; i++) {
    const frame = scene.children.getByName(`botFrame${i}`);
    if (frame) frame.setStrokeStyle(3, currentPlayer === i ? 0xffcc00 : 0xaaaaaa);
    
    const countText = scene.children.getByName(`botCount${i}`);
    if (countText) {
      countText.setText('Karten: ' + players[i].length);
    }
  }

  if (currentPlayer === 0) {
    drawPlayerHand(scene);
    highlightActivePlayer(scene);
    activatePlayerInput(scene);
    createDrawButton(scene);
  } else {
    deactivatePlayerInput(scene);
    scene.time.delayedCall(2000, () => botTurn(scene), [], scene);
  }

  drawCurrentCard(scene);
}

/* Bot-Logik.
   Zuerst wird geprüft, ob ein Strafstapel aktiv ist. Falls ja, versucht der Bot, eine +2 zu spielen.
   Besitzt er keine, zieht er alle Strafkarten. */
function botTurn(scene) {
  let botCards = players[currentPlayer];
  if (plusTwoStack > 0) {
    let index = botCards.findIndex(card => card.value === "+2" && (currentCard.value === "+2" || card.color === currentCard.color));
    if (index !== -1) {
      let card = botCards.splice(index, 1)[0];
      currentCard = card;
      discardPile.push(card);
      plusTwoStack += 2;
      drawCurrentCard(scene);
    } else {
      ensureDeck(plusTwoStack);
      for (let i = 0; i < plusTwoStack; i++) {
        if (deck.length > 0) {
          botCards.push(deck.pop());
        }
      }
      plusTwoStack = 0;
    }
    nextTurn(scene);
    return;
  }

  // Normales Spielen, wenn kein Strafstapel aktiv ist
  let playableIndex = botCards.findIndex(card => isPlayable(card));
  if (playableIndex !== -1) {
    let card = botCards.splice(playableIndex, 1)[0];
    currentCard = card;
    discardPile.push(card);
    if (card.value === "+2") {
      plusTwoStack += 2;
    }
    drawCurrentCard(scene);
  } else {
    ensureDeck(1);
    if (deck.length > 0) {
      let drawnCard = deck.pop();
      botCards.push(drawnCard);
    } else {
      console.log("Deck ist leer, Bot kann nichts tun!");
    }
  }
  nextTurn(scene);
}

/* 
  ensureDeck(count):
  Prüft vor dem Ziehen, ob genügend Karten im Ziehstapel sind.
  Ist der Ziehstapel nicht ausreichend gefüllt, werden alle abgelegten Karten (aus discardPile)
  gemischt und zum Ziehstapel hinzugefügt.
*/
function ensureDeck(count) {
  if (deck.length < count && discardPile.length > 0) {
    // Mische alle Karten im discardPile (die abgelegten Karten) und lege sie in den Ziehstapel.
    deck = deck.concat(Phaser.Utils.Array.Shuffle(discardPile));
    discardPile = [];
  }
}

/* Modal-Funktionalität */
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
