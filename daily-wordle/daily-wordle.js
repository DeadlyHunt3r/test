// Interne Lösungsliste
const solutionList = [
  "armut", "wolke", "bunte", "sonne", "lippe", "knopf", "wachs", "wucht", "eisen", "drama",
  "glatt", "ratte", "ferne", "keule", "rippe", "kohle", "trick", "platz", "sagen", "otter",
  "torte", "ferse", "panda", "sturm", "pferd", "spalt", "sache", "dinge", "fabel", "elche",
  "bogen", "onkel", "fleck", "asche", "glanz", "puppe", "geige", "messe", "boden", "ohren",
  "socke", "segel", "seele", "geier", "glied", "licht", "scham", "nadel", "liebe", "uhren",
  "schaf", "gabel", "adler", "reich", "darme", "bluse", "autor", "hauch", "suppe", "watte",
  "sande", "radio", "weide", "qualm", "sandy", "lunge", "stark", "frech", "wonne", "ozean",
  "alamo", "hexen", "dünen", "seoul", "motte", "magen", "fluss", "tisch", "nudel", "zange",
  "enkel", "eisig", "donau", "kranz", "braun", "stuhl", "mango", "hafen", "fahne", "krise",
  "bande", "bazar", "zebra", "beleg", "zweig", "canis", "rolle", "flöte", "besen", "maske",
  "biber", "angst", "pasta", "regen", "geist", "flair", "teich", "rauch", "serie", "mütze",
  "mauer", "sacht", "traum", "münze", "klima", "kamel", "curry", "hölle", "schuh", "tante",
  "kraut", "reise", "krone", "wiese", "flink", "truhe", "glück", "blick", "dachs", "krieg",
  "stich", "bitte", "krimi", "faser", "wider", "haare", "wange", "runde", "flach", "frost",
  "blitz", "berge", "ebene", "sonne", "traum", "licht", "wolke", "qualm", "brief", "suppe",
  "stein", "fauna", "komet", "säure", "bauch", "fuchs", "leben", "sahne", "pizza", "stern",
  "musik", "dampf", "säule", "dosen", "mutig", "tempo", "leder", "vogel", "stift", "kante",
  "welle", "apfel", "spule", "dreck", "körbe", "paris", "gordo", "waffe", "blech", "biene",
  "kraft", "handy", "sünde", "rosen", "flora", "danke", "kekse", "wagen", "tiger", "zähne",
  "wurst"
];

// Variable für die externe Wortliste (Validierung)
let validWords = [];

// Lade die gzippte Wortliste (wordlist-german.txt.gz) und dekomprimiere sie mit Pako
fetch('wordlist-german.txt.gz')
  .then(response => response.arrayBuffer())
  .then(buffer => {
    const decompressed = pako.ungzip(new Uint8Array(buffer));
    const text = new TextDecoder("utf-8").decode(decompressed);
    validWords = text.split('\n')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length === 5);
  })
  .catch(error => {
    console.error("Fehler beim Laden der gzipped Wortliste:", error);
  });

// Wählt das tägliche Lösungswort aus der internen Liste
function getDailyWord() {
  const today = new Date();
  const seed = today.getFullYear() + today.getMonth() + today.getDate();
  const index = seed % solutionList.length;
  return solutionList[index];
}
const solution = getDailyWord();

let guessHistory = [];

function saveGameState() {
  const today = new Date().toLocaleDateString('de-DE');
  const state = {
    date: today,
    guessHistory: guessHistory
  };
  localStorage.setItem("wordleGameState", JSON.stringify(state));
}

function loadGameState() {
  const storedState = localStorage.getItem("wordleGameState");
  if (storedState) {
    try {
      const state = JSON.parse(storedState);
      const today = new Date().toLocaleDateString('de-DE');
      if (state.date === today) {
        guessHistory = state.guessHistory || [];
        updateAttemptCount();
        updateHistory();
      } else {
        localStorage.removeItem("wordleGameState");
        guessHistory = [];
      }
    } catch(e) {
      console.error("Fehler beim Laden des Spielstands:", e);
    }
  }
}
loadGameState();

function updateAttemptCount() {
  document.getElementById('attemptCount').textContent = "Versuche: " + guessHistory.length;
}

function checkGuess(guess, solution) {
  const result = [];
  const solutionArray = solution.split('');
  // Zuerst richtige Buchstaben an richtiger Stelle markieren
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === solutionArray[i]) {
      result.push({letter: guess[i], color: "var(--letter-green)"});
      solutionArray[i] = null;
    } else {
      result.push({letter: guess[i], color: null});
    }
  }
  // Dann Buchstaben markieren, die zwar vorkommen, aber an falscher Position stehen
  for (let i = 0; i < guess.length; i++) {
    if (result[i].color === null) {
      const pos = solutionArray.indexOf(guess[i]);
      if (pos !== -1) {
        result[i].color = "var(--letter-yellow)";
        solutionArray[pos] = null;
      } else {
        result[i].color = "var(--letter-red)";
      }
    }
  }
  return result;
}

function updateHistory() {
  const historyDiv = document.getElementById('history');
  historyDiv.innerHTML = "";
  const recentGuesses = guessHistory.slice(-5);
  recentGuesses.forEach(guessResult => {
    const row = document.createElement('div');
    row.className = 'guessRow';
    guessResult.forEach(item => {
      const letterDiv = document.createElement('div');
      letterDiv.className = 'letter';
      letterDiv.textContent = item.letter;
      letterDiv.style.backgroundColor = item.color;
      row.appendChild(letterDiv);
    });
    historyDiv.appendChild(row);
  });
}

document.getElementById('submitBtn').addEventListener('click', () => {
  const guessInput = document.getElementById('guessInput');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const guess = guessInput.value.trim().toLowerCase();
  
  if (guess.length !== 5) {
    errorMessage.textContent = "Bitte gib ein 5-Buchstaben-Wort ein.";
    return;
  }
  
  // Warte, falls die externe Wortliste noch nicht geladen ist
  if (validWords.length === 0) {
    errorMessage.textContent = "Wortliste wird noch geladen. Bitte warten.";
    return;
  }
  
  if (!validWords.includes(guess) && !solutionList.includes(guess)) {
    errorMessage.textContent = "Wort nicht bekannt.";
    return;
  }
  
  errorMessage.textContent = "";
  const result = checkGuess(guess, solution);
  guessHistory.push(result);
  updateAttemptCount();
  updateHistory();
  saveGameState();
  
  if (guess === solution) {
    saveScore(guessHistory.length);
    successMessage.textContent = "Herzlichen Glückwunsch, korrekt gelöst! Schau morgen gerne wieder vorbei.";
  }
  
  guessInput.value = "";
});

document.getElementById('guessInput').addEventListener('keyup', (e) => {
  if (e.key === "Enter") {
    document.getElementById('submitBtn').click();
  }
});

async function saveScore(score) {
  const player = localStorage.getItem("currentUser") || "Guest";
  const apiUrl = "https://script.google.com/macros/s/AKfycbzN1dYjIwvmc083UZy_Xqxq_OIAXFXqhBe53Fy75JhDEyarjr4Sxm_h9NcIXHMuiopv/exec";
  const sheetName = "Daily-Wordle";
  const url = `${apiUrl}?sheetName=${encodeURIComponent(sheetName)}&player=${encodeURIComponent(player)}&score=${encodeURIComponent(score)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Fehler! Status: ${response.status}`);
    const data = await response.json();
    console.log("Score erfolgreich gespeichert:", data);
  } catch (error) {
    console.error("Fehler beim Speichern des Scores:", error);
  }
}

let currentUser = localStorage.getItem('currentUser');
if (!currentUser) {
  currentUser = "Gast";
  localStorage.setItem('currentUser', currentUser);
}

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
