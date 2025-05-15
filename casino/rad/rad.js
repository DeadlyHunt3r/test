
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spin-button");
const resultText = document.getElementById("result-text");
const coinDisplay = document.getElementById("coin-count");
const volumeSlider = document.getElementById("volume");
const spinSound = document.getElementById("spin-sound");

const currentUser = localStorage.getItem("currentUser") || "Spieler";
let coins = Number(localStorage.getItem("coins")) || 10000;
coinDisplay.innerText = coins.toLocaleString("de-DE");

const segments = [0, 0, 50, 25, 0, 100, 0, 0, 250, 0, 25, 500];
const segmentColors = ["#f44336", "#e91e63", "#9c27b0", "3f51b5", "#2196f3", "#03a9f4", "#009688", "4caf50", "#8bc34a", "#ffeb3b", "#ffc107"];
const segmentAngle = (2 * Math.PI) / segments.length;

function drawWheel(rotation = 0) {
  for (let i = 0; i < segments.length; i++) {
    const angle = i * segmentAngle + rotation;
    ctx.beginPath();
    ctx.moveTo(200, 200);
    ctx.arc(200, 200, 200, angle, angle + segmentAngle);
    ctx.fillStyle = segmentColors[i];
    ctx.fill();
    ctx.save();
    ctx.translate(200, 200);
    ctx.rotate(angle + segmentAngle / 2);
    ctx.fillStyle = "#000";
    ctx.font = "bold 18px Arial";
    ctx.fillText(segments[i] + "💰", 100, 5);
    ctx.restore();
  }
}
drawWheel();

spinBtn.addEventListener("click", () => {
  if (coins < 200) {
    resultText.textContent = "Nicht genug Coins (200 nötig)";
    return;
  }
  coins -= 200;
  coinDisplay.innerText = coins.toLocaleString("de-DE");
  localStorage.setItem("coins", coins);

  spinSound.volume = volumeSlider.value;
  spinSound.currentTime = 0;
  spinSound.play();

  spinBtn.disabled = true;
  resultText.textContent = "";

  const spinRotation = Math.random() * 360 + 720;
  const duration = 3000;
  let start = null;

  function animate(timestamp) {
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    const rotation = (spinRotation * easeOut(progress)) * Math.PI / 180;
    ctx.clearRect(0, 0, 400, 400);
    drawWheel(rotation);
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      const finalRotation = rotation % (2 * Math.PI);
      const index = Math.floor((segments.length - (finalRotation / segmentAngle)) % segments.length);
      const win = segments[index];
      coins += win;
      coinDisplay.innerText = coins.toLocaleString("de-DE");
      localStorage.setItem("coins", coins);
      resultText.textContent = win > 0 ? `Gewonnen: ${win} Coins!` : "Leider nichts gewonnen!";
      spinBtn.disabled = false;
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
