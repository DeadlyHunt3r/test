// rad.js

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwJTjvb5bGwRQhGKBA_0IdVMD8bl2eKzQX7hotJsG4qFyFxl2d7PhMDhoVsemc8ZIOJpw/exec";

document.addEventListener("DOMContentLoaded", () => {
  const USERNAME = localStorage.getItem("currentUser") || "unbekannt";
  const canvas       = document.getElementById("wheel");
  const ctx          = canvas.getContext("2d");
  const spinBtn      = document.getElementById("spin-button");
  const resultText   = document.getElementById("result-text");
  const coinDisplay  = document.getElementById("coin-count");
  const volumeSlider = document.getElementById("volume");
  const spinSound    = document.getElementById("spin-sound");
  const betSelectHidden = document.getElementById("betAmount");

  let coins = Number(localStorage.getItem("coins")) || 0;
  coinDisplay.innerText = coins.toLocaleString("de-DE");

  function getBet() {
    return Number(betSelectHidden.value);
  }

  // Custom Select-Logik (Auswahl Einsatz)
  const trigger = document.querySelector(".select-trigger");
  const options = document.querySelectorAll(".option");
  trigger.textContent = document
    .querySelector(`.option[data-value='${getBet()}']`)
    .textContent + " ▼";
  trigger.addEventListener("click", () => trigger.parentElement.classList.toggle("open"));
  options.forEach(opt => {
    opt.addEventListener("click", () => {
      betSelectHidden.value = opt.dataset.value;
      trigger.textContent = opt.textContent + " ▼";
      trigger.parentElement.classList.remove("open");
      drawWheel();
    });
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".custom-select")) {
      document.querySelectorAll(".custom-select.open")
        .forEach(c => c.classList.remove("open"));
    }
  });

  // Wheel-Setup
  const segments = [0,0,50,25,0,100,0,0,250,0,25,500];
  const colors   = ["#f44336","#e91e63","#9c27b0","#3f51b5","#2196f3","#03a9f4","#009688","#4caf50","#8bc34a","#ffeb3b","#ffc107","#ff5722"];
  const segmentAngle = (2 * Math.PI) / segments.length;
  const radius       = canvas.width / 2;
  const textRadius   = radius * 0.65;

  function drawWheel(rotation = 0) {
    const bet = getBet();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < segments.length; i++) {
      const angle = i * segmentAngle + rotation;
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius, angle, angle + segmentAngle);
      ctx.fillStyle = colors[i];
      ctx.fill();
      const displayValue = Math.floor(segments[i] * (bet / 200));
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
  drawWheel();

  function onFinish(win) {
    coins += win;
    coinDisplay.innerText = coins.toLocaleString("de-DE");
    localStorage.setItem("coins", coins);
    resultText.textContent = win > 0
      ? `Gewonnen: ${win.toLocaleString('de-DE')} Coins!`
      : "Leider nichts gewonnen!";
    spinBtn.disabled = false;

    // CORS-freundlicher POST (kein JSON)
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

  spinBtn.addEventListener("click", () => {
    const bet = getBet();
    if (coins < bet) {
      resultText.textContent = `Nicht genug Coins (${bet.toLocaleString('de-DE')} nötig)`;
      return;
    }
    coins -= bet;
    coinDisplay.innerText = coins.toLocaleString("de-DE");
    localStorage.setItem("coins", coins);
    spinSound.volume = volumeSlider.value;
    spinSound.currentTime = 0;
    spinSound.play();
    spinBtn.disabled = true;
    resultText.textContent = "";

    const spinRotation = Math.random() * 360 + 720;
    const duration     = 3000;
    let start = null;
    function animate(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const rotation = (spinRotation * easeOut(progress)) * Math.PI / 180;
      drawWheel(rotation);
      if (progress < 1) requestAnimationFrame(animate);
      else {
        const finalRotation = rotation % (2 * Math.PI);
        const idx = Math.floor((segments.length - (finalRotation / segmentAngle)) % segments.length);
        const baseWin = segments[idx];
        const win     = Math.floor(baseWin * (bet / 200));
        onFinish(win);
      }
    }
    requestAnimationFrame(animate);
  });

  volumeSlider.addEventListener("input", () => {
    spinSound.volume = volumeSlider.value;
  });

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }
});
