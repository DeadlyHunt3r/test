const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  parent: 'game-container',
  transparent: true,
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let players = [], currentPlayer = 0, deck = [], discardPile = [], currentCard;
let cardSprites = [], drawButton, scrollOffset = 0, handBorder, plusTwoStack = 0;

const colors = ['rot', 'gelb', 'grün', 'blau'];
const numbers = ['0','1','2','3','4','5','6','7','8','9'];
const positions = [
  { x: 600, y: 700 },
  { x: 150, y: 100 },
  { x: 600, y: 100 },
  { x: 1050, y: 100 }
];
const dropZone = { x: 600, y: 400, width: 160, height: 210 };
const botNames = ["Siegfried","Bob","Hildegard"];

function preload() {
  // Karten und Profilbilder laden
  colors.forEach(c => {
    numbers.forEach(n => this.load.image(`${c}_${n}`, `../assets/cards/${c}_${n}.png`));
    this.load.image(`${c}_+2`, `../assets/cards/${c}_+2.png`);
  });
  this.load.image('botProfile1','../assets/pb/bot1.png');
  this.load.image('botProfile2','../assets/pb/bot2.png');
  this.load.image('botProfile3','../assets/pb/bot3.png');
}

function create() {
  this.children.removeAll();
  // Initiales Deck
  if (deck.length === 0) {
    deck = createDeck();
    Phaser.Utils.Array.Shuffle(deck);
    currentCard = deck.pop();
    for (let i = 0; i < 4; i++) players[i] = deck.splice(0,7);
  }
  drawCurrentCard(this);

  // Bot-Frames, Namen, Zähler und **Statustext**
  for (let i = 1; i < 4; i++) {
    this.add.rectangle(positions[i].x, positions[i].y, 220, 120, 0x444444)
      .setStrokeStyle(3, currentPlayer===i?0xffcc00:0xaaaaaa)
      .setName(`botFrame${i}`);
    this.add.image(positions[i].x, positions[i].y-15, `botProfile${i}`).setDisplaySize(80,80);
    this.add.text(positions[i].x, positions[i].y+45, botNames[i-1], { fontSize:'18px', fill:'#eee' })
      .setOrigin(0.5);
    this.add.text(positions[i].x, positions[i].y+80, 'Karten: '+players[i].length, { fontSize:'16px', fill:'#eee' })
      .setOrigin(0.5).setName(`botCount${i}`);
    // **Hier fügen wir den Statustext ein**
    this.add.text(positions[i].x, positions[i].y+105, '', { fontSize:'14px', fill:'#eee' })
      .setOrigin(0.5).setName(`botStatus${i}`);
  }

  highlightActivePlayer(this);
  drawPlayerHand(this);

  if (currentPlayer===0) {
    activatePlayerInput(this);
    createDrawButton(this);
  } else {
    deactivatePlayerInput(this);
    this.time.delayedCall(2000, ()=>botTurn(this), [], this);
  }

  // DropZone und Scroll-Handler
  const dz = this.add.rectangle(dropZone.x, dropZone.y, dropZone.width, dropZone.height, 0xffffff, 0.1);
  dz.setStrokeStyle(3,0xffffff);
  this.input.on('wheel', (_,__,dx,dy)=>{ scrollOffset -= dy*0.1; drawPlayerHand(this); });
}

function update() {}

function createDeck() {
  let d=[];
  colors.forEach(c=>{
    numbers.forEach(n=>d.push({color:c,value:n}));
    d.push({color:c,value:'+2'},{color:c,value:'+2'});
  });
  return d;
}

function drawCurrentCard(scene) {
  scene.children.list.filter(ch=>ch.currentCard).forEach(ch=>ch.destroy());
  const cont = createCardContainer(scene, currentCard, dropZone.x, dropZone.y);
  cont.currentCard = true;
}

function drawPlayerHand(scene) {
  cardSprites.forEach(cs=>cs.destroy());
  if (handBorder) handBorder.destroy();
  cardSprites=[];

  const hand=players[0];
  const startX=200+scrollOffset, gap=125, cw=120, ch=180;
  const width=(hand.length-1)*gap+cw;
  handBorder = scene.add.rectangle(startX+width/2, positions[0].y, width+20, ch+20)
                      .setStrokeStyle(3,0xffffff).setDepth(-1);

  hand.forEach((card,i)=>{
    const x=startX+i*gap, y=positions[0].y;
    let sprite = scene.add.image(60,0,`${card.color}_${card.value}`)
      .setDisplaySize(120,180).setOrigin(0.5);
    let cont = scene.add.container(x,y,[sprite]);
    cont.originalX=x; cont.originalY=y;
    cont.setSize(cw,ch);
    cont.setInteractive(new Phaser.Geom.Rectangle(60,0,cw,ch), Phaser.Geom.Rectangle.Contains);
    scene.input.setDraggable(cont);
    cont.card = card;
    cardSprites.push(cont);
  });
}

function createCardContainer(scene,card,x,y) {
  let spr = scene.add.image(0,0,`${card.color}_${card.value}`)
    .setDisplaySize(120,180).setOrigin(0.5);
  return scene.add.container(x,y,[spr]);
}

function isPlayable(card) {
  if (plusTwoStack>0) {
    return card.value==='+2' && (currentCard.value==='+2'||card.color===currentCard.color);
  }
  if (card.value==='+2') {
    return (currentCard.value==='+2'||card.color===currentCard.color);
  }
  return card.color===currentCard.color||card.value===currentCard.value;
}

function activatePlayerInput(scene) {
  scene.input.on('dragstart',(_,g)=>{ if(currentPlayer===0)g.setScale(1.1); });
  scene.input.on('drag',(_,g,dx,dy)=>{ if(currentPlayer===0){g.x=dx;g.y=dy;} });
  scene.input.on('dragend',(_,g)=>{
    if (currentPlayer!==0) return;
    g.setScale(1);
    const dropRect = new Phaser.Geom.Rectangle(
      dropZone.x-dropZone.width/2, dropZone.y-dropZone.height/2,
      dropZone.width, dropZone.height
    );
    if (Phaser.Geom.Rectangle.ContainsPoint(dropRect, {x:g.x,y:g.y}) && isPlayable(g.card)) {
      playPlayerCard(g.card);
      g.destroy();
      cardSprites = cardSprites.filter(cs=>cs!==g);
      removeDrawButton();
      nextTurn(game.scene.scenes[0]);
    } else {
      g.x=g.originalX; g.y=g.originalY;
    }
  });
}

function deactivatePlayerInput(scene) {
  cardSprites.forEach(cs=>cs.disableInteractive());
}

function createDrawButton(scene) {
  const txt = plusTwoStack>0?'Strafkarten ziehen':'Karte ziehen';
  drawButton = scene.add.text(100,550,txt,{
    fontSize:'24px', backgroundColor:'transparent',
    padding:{x:12,y:8}, fill:'#fff', fontStyle:'bold'
  }).setInteractive().on('pointerdown',()=>{
    if (plusTwoStack>0) {
      ensureDeck(plusTwoStack);
      for (let i=0;i<plusTwoStack;i++) if(deck.length) players[0].push(deck.pop());
      plusTwoStack=0;
    } else {
      ensureDeck(1);
      if (deck.length) players[0].push(deck.pop());
    }
    removeDrawButton();
    nextTurn(game.scene.scenes[0]);
  });
}

function removeDrawButton(){
  if(drawButton){ drawButton.destroy(); drawButton=null; }
}

function playPlayerCard(card){
  const idx=players[0].findIndex(c=>c.color===card.color&&c.value===card.value);
  if(idx!==-1){
    players[0].splice(idx,1);
    currentCard=card;
    discardPile.push(card);
    if(card.value==='+2') plusTwoStack+=2;
    drawCurrentCard(game.scene.scenes[0]);
  }
}

function highlightActivePlayer(scene){
  if(currentPlayer!==0){
    scene.add.rectangle(positions[0].x,positions[0].y,260,160)
      .setStrokeStyle(3,0xffcc00,0.3).setDepth(-1).setOrigin(0.5);
  }
}

function ensureDeck(count){
  if(deck.length<count && discardPile.length){
    deck = deck.concat(Phaser.Utils.Array.Shuffle(discardPile));
    discardPile = [];
  }
}

function nextTurn(scene){
  // Gewinn prüfen
  for(let i=0;i<players.length;i++){
    if(players[i].length===0){
      const text = i===0?'Du hast gewonnen!': botNames[i-1]+' hat gewonnen!';
      showWinModal(scene,text);
      return;
    }
  }
  currentPlayer=(currentPlayer+1)%4;
  // Update Bot-Frame & Zählung, **Status bleibt erhalten**
  for(let i=1;i<4;i++){
    const f = scene.children.getByName(`botFrame${i}`);
    if(f) f.setStrokeStyle(3, currentPlayer===i?0xffcc00:0xaaaaaa);
    const ct = scene.children.getByName(`botCount${i}`);
    if(ct) ct.setText('Karten: '+players[i].length);
  }
  if(currentPlayer===0){
    drawPlayerHand(scene);
    highlightActivePlayer(scene);
    activatePlayerInput(scene);
    createDrawButton(scene);
  } else {
    deactivatePlayerInput(scene);
    scene.time.delayedCall(2000,()=>botTurn(scene),[],scene);
  }
  drawCurrentCard(scene);
}

function botTurn(scene){
  let botCards = players[currentPlayer];
  const statusText = scene.children.getByName(`botStatus${currentPlayer}`);
  // +2-Stack
  if(plusTwoStack>0){
    const penalty = plusTwoStack;
    const idx = botCards.findIndex(c=>c.value==='+2'&&(currentCard.value==='+2'||c.color===currentCard.color));
    if(idx!==-1){
      statusText.setText('legt eine +2 Karte');
      const card = botCards.splice(idx,1)[0];
      currentCard=card; discardPile.push(card); plusTwoStack+=2;
      drawCurrentCard(scene);
    } else {
      statusText.setText(`zieht ${penalty} Strafkarten`);
      ensureDeck(penalty);
      for(let i=0;i<penalty;i++) if(deck.length) botCards.push(deck.pop());
      plusTwoStack=0;
    }
    nextTurn(scene); return;
  }
  // Normalzug
  const pi = botCards.findIndex(isPlayable);
  if(pi!==-1){
    statusText.setText('legt eine Karte');
    const card = botCards.splice(pi,1)[0];
    currentCard=card; discardPile.push(card);
    if(card.value==='+2') plusTwoStack+=2;
    drawCurrentCard(scene);
  } else {
    statusText.setText('zieht eine Karte');
    ensureDeck(1);
    if(deck.length) botCards.push(deck.pop());
  }
  nextTurn(scene);
}

function showWinModal(scene,winnerText){
  const w=400,h=200;
  const x=scene.cameras.main.centerX-w/2, y=scene.cameras.main.centerY-h/2;
  const modal=scene.add.container(x,y);
  const bg=scene.add.rectangle(w/2,h/2,w,h,0x000000,0.8).setStrokeStyle(2,0xffffff);
  modal.add(bg);
  const wt=scene.add.text(w/2,60,winnerText,{fontSize:'28px',fill:'#fff'}).setOrigin(0.5);
  modal.add(wt);
  const btn=scene.add.text(w/2,130,'Neustarten',{fontSize:'24px',backgroundColor:'#3a3a3c',padding:{x:12,y:8},fill:'#fff'})
    .setOrigin(0.5).setInteractive();
  btn.on('pointerdown',()=>{
    deck=[]; discardPile=[]; players=[]; currentPlayer=0; plusTwoStack=0;
    scene.scene.restart();
  });
  modal.add(btn);
}

// Modal-Logik fürs Info-Icon
document.getElementById("info-icon").addEventListener("click",()=>document.getElementById("info-modal").style.display="block");
document.getElementsByClassName("close")[0].addEventListener("click",()=>document.getElementById("info-modal").style.display="none");
window.addEventListener("click",e=>{ if(e.target==document.getElementById("info-modal")) document.getElementById("info-modal").style.display="none"; });
