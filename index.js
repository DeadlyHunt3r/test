// Global: Setze das Startdatum für die Saison
const sessionStartDate = new Date("2025-03-15T20:30:00");

// ---------------------------
// Caching-Mechanismus einbauen
// ---------------------------
const apiCache = {};
async function fetchData(url, cacheKey, ttl = 300000) {
  const now = Date.now();
  if (apiCache[cacheKey] && (now - apiCache[cacheKey].timestamp < ttl)) {
    return apiCache[cacheKey].data;
  }
  try {
    const response = await fetch(url);
    const data = await response.json();
    apiCache[cacheKey] = { data, timestamp: now };
    return data;
  } catch (error) {
    console.error(`Fehler beim Abrufen von ${url}:`, error);
    return [];
  }
}

// ---------------------------
// Basis-Funktionen & Status
// ---------------------------
function showMessage(message, duration = 3000) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, duration);
}

function showLoading() {
  document.getElementById("loadingOverlay").style.display = "flex";
}

function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}

let currentUser = null;
let inactivityTimeout;

// ---------------------------
// Elemente ermitteln
// ---------------------------
const loginModal = document.getElementById("loginModal");
const registerModal = document.getElementById("registerModal");
const adminModal = document.getElementById("adminModal");
const gamesModal = document.getElementById("gamesModal");
const highscoreGamesModal = document.getElementById("highscoreGamesModal");
const scoreModal = document.getElementById("scoreModal");
const changelogModal = document.getElementById("changelogModal");
const phoenixFusionModal = document.getElementById("phoenixFusionModal");
const btnPhoenixFusionGross = document.getElementById("btnPhoenixFusionGross");
const btnPhoenixFusionNormal = document.getElementById("btnPhoenixFusionNormal");
const sessionModal = document.getElementById("sessionModal");
const sessionCountdownModal = document.getElementById("sessionCountdownModal");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const adminBtn = document.getElementById("adminBtn");
const highscoreBtn = document.getElementById("highscoreBtn");
const changelogBtn = document.getElementById("changelogBtn");
const gamesBtn = document.getElementById("gamesBtn");
const sessionBtn = document.getElementById("sessionBtn");
const sessionHighscoreBtn = document.getElementById("sessionHighscoreBtn");
const sessionGameBtn = document.getElementById("sessionGameBtn");
const luckyBtn = document.getElementById("luckyBtn");

const logoElement = document.getElementById("logo");
const notification = document.getElementById("notification");
const adminModalContent = document.getElementById("adminModalContent");
const gameListGamesDiv = document.getElementById("gameListGames");
const gameListHighscoreDiv = document.getElementById("gameListHighscore");
const scoreDetailsDiv = document.getElementById("scoreDetails");
const changelogContent = document.getElementById("changelogContent");
const countdownTimer = document.getElementById("countdownTimer");

// ---------------------------
// Prüfen, ob ein Benutzer im localStorage vorhanden ist
// ---------------------------
(function initUser() {
  const storedUser = localStorage.getItem("currentUser");
  if (!storedUser) return;
  currentUser = storedUser;

  // 1. Basis-UI aufbauen
  loginBtn.textContent = "Logout";
  adminBtn.style.display = currentUser.toLowerCase() === "admin" ? "inline-block" : "none";
  luckyBtn.style.display = "inline-block";

  const membershipInfo = localStorage.getItem("membershipInfo") || "";
  // Wir erstellen hier nur noch das Gerüst für die Coins-Anzeige,
  // der tatsächliche Wert wird in refreshCoins() gefüllt.
  logoElement.innerHTML = `
    Panda Gaming – A Phoenix Events Creation<br>
    <small>${currentUser}${membershipInfo}
      <span class="coins-display" style="margin-left:10px;font-weight:bold;">
        Coins: <span class="coins-value">0</span>
      </span>
    </small>
  `;

  resetInactivityTimer();

  // 2. Coins aus dem Backend holen und anzeigen
  refreshCoins();
})();

// ---------------------------
// Event-Listener
// ---------------------------
gamesBtn.addEventListener("click", openGamesModal);
highscoreBtn.addEventListener("click", openHighscoreGamesModal);
changelogBtn.addEventListener("click", openChangelogModal);
sessionBtn.addEventListener("click", () => {
  if (!currentUser) return showMessage("Bitte erst anmelden");
  sessionModal.style.display = "block";
});

btnPhoenixFusionGross.addEventListener("click", () => {
  phoenixFusionModal.style.display = "none";
  openScoreModal("Phoenix-Fusion-Groß");
});
btnPhoenixFusionNormal.addEventListener("click", () => {
  phoenixFusionModal.style.display = "none";
  openScoreModal("Phoenix-Fusion-Normal");
});
loginBtn.addEventListener("click", toggleLogin);
// Aktualisierte Event-Listener-Logik für Lucky Button
luckyBtn.addEventListener("click", async () => {
  if (!currentUser) {
    return showMessage("Bitte erst anmelden");
  }

  // Nur erlaubte Nutzer weiterleiten
  const allowedUsers = ["admin", "sir_lew", "miu", "eddy", "snob"]; // Liste der erlaubten Benutzernamen in Kleinbuchstaben

  // Zeige Loading
  showLoading();
  try {
    // Coins aktuell aus Backend holen
    await refreshCoins();

    // Prüfen, ob Nutzer in der Allowlist ist
    if (!allowedUsers.includes(currentUser.toLowerCase())) {
      return showMessage("Zugriff auf Lucky Panda derzeit nur für Testnutzer freigegeben.");
    }

    // Nach erfolgreichem Laden und Prüfung weiterleiten
    window.location.href = "casino/casino.html";
  } catch (err) {
    console.error("Fehler beim Laden der Coins vor Weiterleitung:", err);
    showMessage("Konnte Coins nicht laden. Bitte versuche es später erneut.");
  } finally {
    // Lade-Overlay ausblenden
    hideLoading();
  }
});

sessionHighscoreBtn.addEventListener("click", () => {
  sessionModal.style.display = "none";
  openScoreModal("season-highscore");
});
sessionGameBtn.addEventListener("click", () => {
  sessionModal.style.display = "none";
  openSessionCountdown();
});

// Close Modals
[loginModal, registerModal, adminModal, gamesModal, highscoreGamesModal, scoreModal, changelogModal, phoenixFusionModal, sessionModal, sessionCountdownModal].forEach(modal => {
  const closeBtn = modal.querySelector(".close");
  if (closeBtn) closeBtn.addEventListener("click", () => modal.style.display = "none");
});
window.addEventListener("click", e => {
  [loginModal, registerModal, adminModal, gamesModal, highscoreGamesModal, scoreModal, changelogModal, phoenixFusionModal, sessionModal, sessionCountdownModal]
    .forEach(modal => { if (e.target === modal) modal.style.display = "none"; });
});
registerBtn.addEventListener("click", () => registerModal.style.display = "block");

// ---------------------------
// Login-Logik
// ---------------------------
async function toggleLogin() {
  if (currentUser) return doLogout();
  loginModal.style.display = "block";
}

document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  showLoading();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    // Login‑Request wie gehabt
    const data = await fetchData(
      `https://script.google.com/macros/s/AKfycbxdb_bo-KKqIf1yyQQlbI3nRPw_moF9QWY0ltpLxFy87mvOOAPumi6RUFekfUmEXEhy/exec`
      + `?search=${encodeURIComponent(JSON.stringify({username}))}&cacheBust=${Date.now()}`,
      "login"
    );
    hideLoading();

    const validUser = data.find(u =>
      u.username === username &&
      u.password.toString().trim() === password.trim()
    );
    if (!validUser) {
      return showMessage("Benutzername oder Passwort falsch");
    }

    // ─── Neuer Teil: Daten speichern und UI-Gerüst aufbauen ───
    currentUser = username;
    localStorage.setItem("currentUser", currentUser);
    localStorage.setItem("coins", validUser.coins || 0);

    // Mitgliedschaft
    if (!["admin", "frechdachs"].includes(username.toLowerCase())) {
      const raw = validUser.mitgliedschaft || validUser.Mitgliedschaft;
      const date = raw.includes("T")
        ? new Date(raw)
        : (() => {
            const p = raw.split(".");
            return new Date(p[2], p[1] - 1, p[0]);
          })();
      const diff = date - Date.now();
      if (diff < 0) {
        return showMessage("Mitgliedschaft abgelaufen");
      }
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const info = ` - Mitgliedschaft: ${days} Tag(e) gültig`;
      localStorage.setItem("membershipInfo", info);
    }

    // UI Update: Grundgerüst mit coins-value-Span
    loginBtn.textContent = "Logout";
    adminBtn.style.display =
      currentUser.toLowerCase() === "admin" ? "inline-block" : "none";
    luckyBtn.style.display = "inline-block";
    const membershipInfo = localStorage.getItem("membershipInfo") || "";
    logoElement.innerHTML = `
      Panda Gaming – A Phoenix Events Creation<br>
      <small>${currentUser}${membershipInfo}
        <span class="coins-display" style="margin-left:10px;font-weight:bold;">
          Coins: <span class="coins-value">0</span>
        </span>
      </small>
    `;

    // Hier holen wir die echten Coins und formatieren sie
    refreshCoins();

    // Abschließen
    loginModal.style.display = "none";
    resetInactivityTimer();
    showMessage("Anmeldung erfolgreich!");
  } catch (err) {
    hideLoading();
    console.error(err);
    showMessage("Fehler bei der Anmeldung");
  }
});

function doLogout() {
  clearTimeout(inactivityTimeout);
  localStorage.removeItem("currentUser");
  localStorage.removeItem("membershipInfo");
  loginBtn.textContent = "Login";
  adminBtn.style.display = "none";
  luckyBtn.style.display = "none";
  logoElement.innerHTML = "Panda Gaming – A Phoenix Events Creation";
  showMessage("Logout erfolgreich");
  currentUser = null;
}

function resetInactivityTimer() {
  if (!currentUser) return;
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(doLogout, 3600000);
}

async function refreshCoins() {
  if (!currentUser) return;
  console.log("🔄 refreshCoins für", currentUser);
  try {
    const url = 
      `https://script.google.com/macros/s/AKfycbxdb_bo-KKqIf1yyQQlbI3nRPw_moF9QWY0ltpLxFy87mvOOAPumi6RUFekfUmEXEhy/exec`
      + `?search=${encodeURIComponent(JSON.stringify({username: currentUser}))}`;
    const users = await fetchData(url, "coins", 300000);
    console.log("📥 refreshCoins Daten:", users);
    const me = users.find(u => u.username === currentUser);
    const newCoins = me?.coins || 0;
    localStorage.setItem("coins", newCoins);

    const coinsValueSpan = document.querySelector(".coins-value");
    if (coinsValueSpan) {
      coinsValueSpan.textContent = newCoins.toLocaleString("de-DE");
    }
  } catch (err) {
    console.error("🚨 Fehler beim Aktualisieren der Coins:", err);
  }
}

// ---------------------------
// Admin-Panel
// ---------------------------
async function openAdminPanel() {
  showLoading();
  try {
    const list = await fetchData('https://script.google.com/macros/s/…/exec', 'admin');
    hideLoading();
    adminModalContent.innerHTML = "";
    list.forEach(u => {
      const div = document.createElement("div"); div.className = "user-entry";
      const online = u.isLoggedIn.toString().toLowerCase() === "true" ? "Online" : "Offline";
      div.innerHTML = `<div class="user-info"><strong>${u.username}</strong> - ${online}</div><div class="user-action">${online === "Online" ? `<button class="button" onclick="forceLogoutUser('${u.username}')">Ausloggen</button>` : ""}</div>`;
      adminModalContent.appendChild(div);
    });
    adminModal.style.display = "block";
  } catch {
    hideLoading(); showMessage("Fehler Admin-Panel");
  }
}
window.forceLogoutUser = username => { showMessage(`User ${username} ausgeloggt`); openAdminPanel(); };

// ---------------------------
// Spiele-Modal
// ---------------------------
async function openGamesModal() {
  showLoading();
  try {
    const data = await fetchData(
      'https://script.google.com/macros/s/AKfycbxdb_bo-KKqIf1yyQQlbI3nRPw_moF9QWY0ltpLxFy87mvOOAPumi6RUFekfUmEXEhy/exec?sheet=Games', 'gamesList'
    );
    hideLoading();
    const games = [...new Set(data.map(item => item.game).filter(Boolean))];
    gameListGamesDiv.innerHTML = "";
    if (!games.length) {
      gameListGamesDiv.innerHTML = "<p>Keine Spiele gefunden.</p>";
    } else {
      games.forEach(game => {
        const btn = document.createElement("button"); btn.className = "button"; btn.style.margin = "5px 0";
        btn.textContent = game;
        btn.addEventListener("click", () => {
          if (!currentUser) return showMessage("Bitte erst anmelden");
          const now = new Date(); const hour = now.getHours(); const minute = now.getMinutes();
          if ((/daily-(sudoku|wordle)/i.test(game)) && hour === 0 && minute < 20) {
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 20, 0);
            const ms = target - now;
            const min = Math.floor(ms / 60000);
            const sec = Math.floor((ms % 60000) / 1000);
            showMessage(`${/sudoku/i.test(game)? 'Neues Sudoku wird erstellt.' : 'Neues Wort wird gesucht.'} Bitte warte ${min} Minuten und ${sec} Sekunden.`);
            return;
          }
          gamesModal.style.display = "none";
          const folder = game.toLowerCase().replace(/\s+/g, '');
          window.location.href = `${folder}/${folder}.html`;
        });
        gameListGamesDiv.appendChild(btn);
      });
    }
    gamesModal.style.display = "block";
  } catch (e) {
    hideLoading(); showMessage("Fehler beim Abrufen der Spiele"); console.error(e);
  }
}

async function openHighscoreGamesModal() {
  showLoading();
  try {
    const data = await fetchData(
      'https://script.google.com/macros/s/AKfycbxdb_bo-KKqIf1yyQQlbI3nRPw_moF9QWY0ltpLxFy87mvOOAPumi6RUFekfUmEXEhy/exec?sheet=Games', 'gamesList'
    );
    hideLoading();
    const games = [...new Set(data.map(item => item.game).filter(Boolean))];
    gameListHighscoreDiv.innerHTML = "";
    if (!games.length) {
      gameListHighscoreDiv.innerHTML = "<p>Keine Spiele gefunden.</p>";
    } else {
      games.forEach(game => {
        const btn = document.createElement("button"); btn.className = "button"; btn.style.margin = "5px 0";
        btn.textContent = game;
        btn.addEventListener("click", () => {
          highscoreGamesModal.style.display = "none";
          if (/phoenix-fusion/i.test(game)) {
            phoenixFusionModal.style.display = "block";
          } else {
            openScoreModal(game);
          }
        });
        gameListHighscoreDiv.appendChild(btn);
      });
    }
    highscoreGamesModal.style.display = "block";
  } catch (e) {
    hideLoading(); showMessage("Fehler beim Abrufen der Highscore-Spiele"); console.error(e);
  }
}

function openChangelogModal() {
  showLoading();
  fetchData(
    'https://script.google.com/macros/s/AKfycbxdb_bo-KKqIf1yyQQlbI3nRPw_moF9QWY0ltpLxFy87mvOOAPumi6RUFekfUmEXEhy/exec?sheet=Changelog',
    'changelog'
  )
    .then(data => {
      hideLoading();
      changelogContent.innerHTML = data.length
        ? data.map(row => `<p>${Object.values(row).join(' ')}</p>`).join('')
        : `<p>Kein Changelog vorhanden.</p>`;
      changelogModal.style.display = "block";
    })
    .catch(e => {
      hideLoading();
      showMessage("Fehler beim Laden des Changelogs");
      console.error(e);
    });
}

function openSessionCountdown() {
  sessionCountdownModal.style.display = "block";
  const interval = setInterval(() => {
    const diff = sessionStartDate - new Date();
    if (diff <= 0) {
      clearInterval(interval);
      countdownTimer.textContent = "Die Season ist zu Ende!";
    } else {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      countdownTimer.textContent = `Noch ${days} Tage, ${hours} Stunden und ${minutes} Minuten bis zur Season 1`;
    }
  }, 1000);
}

async function openScoreModal(selectedGame) {
  showLoading();
  try {
    const apiURL = `https://script.google.com/macros/s/AKfycbxdb_bo-KKqIf1yyQQlbI3nRPw_moF9QWY0ltpLxFy87mvOOAPumi6RUFekfUmEXEhy/exec?sheet=${encodeURIComponent(selectedGame)}`;
    const data = await fetchData(apiURL, `score_${selectedGame}`, 60000);
    hideLoading();
    const playerScores = {};
    data.forEach(entry => {
      const name = (entry.player || entry.username).trim();
      const score = Number(entry.score);
      if (!playerScores[name] || score > playerScores[name].score) {
        playerScores[name] = { name, score };
      }
    });
    // Sortieren und Top 10
    const sorted = Object.values(playerScores).sort((a, b) => b.score - a.score);
    const topTen = sorted.slice(0, 10);

    // HTML für Top 10
    let html = '';
    if (topTen.length) {
      topTen.forEach((e, i) => {
        html += `<div style="display:flex;justify-content:space-between;padding:5px 0;">${i+1}. ${e.name}<span>${e.score.toLocaleString('de-DE')}</span></div>`;
      });
    } else {
      html = `<p>Keine Scores für dieses Spiel gefunden.</p>`;
    }

    // Eigene Position unter Top 10 immer anzeigen
    if (currentUser) {
      const ownEntry = sorted.find(e => e.name.toLowerCase() === currentUser.toLowerCase());
      if (ownEntry) {
        const ownIndex = sorted.indexOf(ownEntry) + 1;
        html += `<hr>`;
        html += `<div style="display:flex;justify-content:space-between;padding:5px 0;"><span>${ownIndex}. ${ownEntry.name}</span><span>${ownEntry.score.toLocaleString('de-DE')}</span></div>`;
      }
    }

    scoreDetailsDiv.innerHTML = html;
    scoreModal.style.display = "block";
  } catch (e) {
    hideLoading();
    showMessage("Fehler beim Abrufen der Scores");
    console.error(e);
  }
}
