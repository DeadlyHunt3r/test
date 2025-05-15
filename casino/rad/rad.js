const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwJTjvb5bGwRQhGKBA_0IdVMD8bl2eKzQX7hotJsG4qFyFxl2d7PhMDhoVsemc8ZIOJpw/exec";

document.addEventListener("DOMContentLoaded", () => {
  // grundlegende Elemente
  const USERNAME    = localStorage.getItem("currentUser") || "unbekannt";
  const canvas      = document.getElementById("wheel");
  const ctx         = canvas.getContext("2d");
  const spinBtn     = document.getElementById("spin-button");
  const resultText  = document.getElementById("result-text");
  const coinDisplay = document.getElementById("coin-count");
  const volumeSlider= document.getElementById("volume");
  const spinSound   = document.getElementById("spin-sound");
  const costDisplay = document.getElementById("cost-display");

  // Modal-Elemente für Einsatz-Auswahl
  const betModal    = document.getElementById("bet-modal");
  const openModal   = document.getElementById("open-bet-modal");
  const closeModal  = document.getElementById("close-bet-modal");
  const betOptions  = document.querySelectorAll("#bet-options li");

  // Spielzustand
  let coins      = Number(localStorage.getItem("coins")) || 0;
  let currentBet = 200;
  coinDisplay.innerText = coins.toLocaleString("de-DE");

  // Segmente fürs Glücksrad
  const segments      = [0,0,50,0,25,100,0,0,250,0,25,500];
  const colors        = ["#f44336","#e91e63","#9c27b0","#3f51b5","#2196f3","#03a9f4","#009688","#4caf50","#8bc34a","#ffeb3b","#ffc107","#ff5722"];
  const segmentAngle  = (2 * Math.PI) / segments.length;
  const radius        = canvas.width / 2;
  const textRadius    = radius * 0.65;

  // Zeichnet das Rad basierend auf currentBet
  function drawWheel(rotation = 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < segments.length; i++) {
      const angle = i * segmentAngle + rotation;
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius, angle, angle + segmentAngle);
      ctx.fillStyle = colors[i];
      ctx.fill();

      // Wert anzeigen
      const displayValue = Math.floor(segments[i] * (currentBet / 200));
      ctx.save();
      ctx.translate(radius, radius);
      ctx.rotate(angle + segmentAngle / 2);
      ctx.fillStyle = "#000";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayValue + "💰", textRadius, 0);
      ctx.restore();
    }
  }

  // Aktualisiert Anzeige und Rad
  function updateCostDisplay() {
    costDisplay.textContent = `Aktueller Einsatz: ${currentBet.toLocaleString("de-DE")} Coins`;
    drawWheel(); 
  }

  // Modal öffnen/schließen
  openModal.addEventListener("click", () => {
    betModal.style.display = "flex";
  });
  closeModal.addEventListener("click", () => {
    betModal.style.display = "none";
  });

  // Auswahl im Modal
  betOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      currentBet = Number(opt.dataset.value);
      updateCostDisplay();
      betModal.style.display = "none";
    });
  });

  // Aktion bei Drehende
  function onFinish(win) {
    coins += win;
    coinDisplay.innerText = coins.toLocaleString("de-DE");
    localStorage.setItem("coins", coins);

    resultText.textContent = win > 0
      ? `Gewonnen: ${win.toLocaleString('de-DE')} Coins!`
      : "Leider nichts gewonnen!";

    spinBtn.disabled = false;

    // Update Google Sheet
    fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: USERNAME, coins: coins })
    })
    .then(r => r.json())
    .then(d => {
      if (d.status !== "OK") console.error("Sheet‑Update fehlgeschlagen:", d);
    })
    .catch(err => console.error("Sheet‑Request Error:", err));
  }

  // Spin-Button Logik
  spinBtn.addEventListener("click", () => {
    if (coins < currentBet) {
      resultText.textContent = `Nicht genug Coins (${currentBet.toLocaleString('de-DE')} nötig)`;
      return;
    }

    // Coins abbuchen
    coins -= currentBet;
    localStorage.setItem("coins", coins);
    coinDisplay.innerText = coins.toLocaleString("de-DE");

    // Sound starten
    spinSound.volume = volumeSlider.value;
    spinSound.currentTime = 0;
    spinSound.play();

    // Button deaktivieren & Start Anim
    spinBtn.disabled = true;
    resultText.textContent = "";

    const spinRotation = Math.random() * 360 + 720;
    const duration     = 3000;
    let startTime      = null;

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const rotation = (spinRotation * eased) * Math.PI / 180;

      drawWheel(rotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const finalRotation = rotation % (2 * Math.PI);
        const idx = Math.floor((segments.length - (finalRotation / segmentAngle)) % segments.length);
        const baseWin = segments[idx];
        const win = Math.floor(baseWin * (currentBet / 200));
        onFinish(win);
      }
    }

    requestAnimationFrame(animate);
  });

  // Lautstärke ändern
  volumeSlider.addEventListener("input", () => {
    spinSound.volume = volumeSlider.value;
  });

  // Initiales Zeichnen & Anzeige
  updateCostDisplay();
});
