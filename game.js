let encryptedWords = window.encryptedWords || [];
const passphrase = "base64";
const maxHints = 3;
const maxGuesses = 6;
const fadeDelay = 500;
const testingMode = false;
const millisPerPeriod = testingMode ? 60 * 1000 : 86400 * 1000;
const epoch = testingMode
  ? new Date(new Date().setSeconds(0, 0)).setMinutes(0, 0, 0)
  : new Date(Date.UTC(2024, 6, 1, 0, 0, 0)).getTime();

let currentWord = "";
let revealedLetters = [];
let guesses = [];
let hintOrder = [];
let hintsUsed = 0;
let correctGuesses = 0;
let gameComplete = false;

function getDayIndex() {
  const now = new Date();
  const localNow = now.getTime();
  const diff = localNow - epoch;
  const dayIndex = Math.floor(diff / millisPerPeriod);
  return dayIndex;
}

function getWordForToday() {
  const idx = getDayIndex();
  if (idx < encryptedWords.length) return decryptWord(encryptedWords[idx], idx);
  const pseudo = idx % encryptedWords.length;
  return decryptWord(encryptedWords[pseudo], pseudo);
}

function decryptWord(encrypted, index) {
  try {
    const key = passphrase + index;
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const original = bytes.toString(CryptoJS.enc.Utf8);
    return original;
  } catch (e) {
    console.error("Decryption failed:", e);
    return "ERROR";
  }
}

function getLocalKey() {
  return "reveal" + getDayIndex();
}

function restoreGame() {
  const saved = localStorage.getItem(getLocalKey());
  if (saved) {
    const state = JSON.parse(saved);
    guesses = state.guesses || [];
    revealedLetters = state.revealedLetters || [];
    hintsUsed = state.hintsUsed || 0;
    gameComplete = state.gameComplete;
  }
}

function saveGame() {
  const state = { guesses, revealedLetters, hintsUsed, gameComplete };
  localStorage.setItem(getLocalKey(), JSON.stringify(state));
}

function updateHintsLeft() {
  const ledContainer = document.getElementById("hintsLeft");
  ledContainer.innerHTML = "";
  for (let i = 0; i < maxHints; i++) {
    const led = document.createElement("div");
    led.className = "hint-led" + (i < hintsUsed ? " used" : "");
    ledContainer.appendChild(led);
  }
}

function renderWord() {
  const wordDiv = document.getElementById("word");
  wordDiv.innerHTML = "";
  currentWord.split("").forEach((ch, i) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    if (revealedLetters[i] === "correct") tile.classList.add("correct");
    else if (revealedLetters[i] === "hint") tile.classList.add("hint");
    tile.style.animationDelay = `${i * fadeDelay}ms`;
    tile.textContent = revealedLetters[i] ? ch : "";
    wordDiv.appendChild(tile);
  });
}

function renderKeyboard() {
  const layout = [
    "QWERTYUIOP",
    "ASDFGHJKL",
    "ZXCVBNM"
  ];
  const container = document.getElementById("keyboard");
  container.innerHTML = "";
  layout.forEach(row => {
    const div = document.createElement("div");
    div.className = "keyrow";
    row.split("").forEach(k => {
      const btn = document.createElement("button");
      btn.textContent = k;
      btn.className = "key";
      btn.id = "key_" + k;
      btn.onclick = () => guessLetter(k);
      div.appendChild(btn);
    });
    container.appendChild(div);
  });
}

function disableKey(k, className = "disabled") {
  const btn = document.getElementById("key_" + k.toUpperCase());
  if (btn) {
    btn.classList.add(className);
    btn.disabled = true;
  }
}

function guessLetter(letter) {
  if (gameComplete) return;
  guesses.push(letter);
  const idxs = [];
  currentWord.split("").forEach((ch, i) => {
    if (ch.toUpperCase() === letter.toUpperCase()) {
      revealedLetters[i] = "correct";
      idxs.push(i);
    }
  });

  if (idxs.length) {
    idxs.forEach(i => disableKey(currentWord[i], "correct"));
  } else {
    disableKey(letter, "wrong");
    if (guesses.length > 3) {
      if (!revealHint()) {
        gameComplete = true;
        showWordComplete(false);
        saveGame();
        return;
      }
    }
  }

  renderWord();
  updateHintsLeft();
  checkWin();
  saveGame();
}

function revealHint() {
  if (hintsUsed >= maxHints) return false;
  const idx = hintOrder[hintsUsed];
  if (revealedLetters[idx]) return false;
  revealedLetters[idx] = "hint";
  disableKey(currentWord[idx], "hintkey");
  hintsUsed++;
  updateHintsLeft();
  renderWord();
  return true;
}

function checkWin() {
  if (revealedLetters.every(v => v)) {
    gameComplete = true;
    showWordComplete(true);
    saveGame();
  }
}

function showWordComplete(won) {
  const wrap = document.getElementById("wordWrapper");
  wrap.classList.add("complete");
  document.querySelectorAll(".key").forEach(k => k.disabled = true);
  const summary = document.getElementById("summary");
  summary.textContent = won ? `Solved in ${guesses.length} guesses and ${hintsUsed} hints!` : "❌ Failed to solve the word.";
  fetchDefinition(currentWord);
  updateStats(won);
}

function fetchDefinition(word) {
  const def = document.getElementById("definition");
  fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
    .then(r => r.json())
    .then(data => {
      if (data && Array.isArray(data) && data[0]?.meanings?.length) {
        def.textContent = data[0].meanings[0].definitions[0].definition || "";
      } else {
        def.textContent = "(No definition found)";
      }
    })
    .catch(() => def.textContent = "(Error fetching definition)");
}

function updateStats(won) {
  const statsKey = "revealStats";
  let stats = JSON.parse(localStorage.getItem(statsKey) || "{}");
  stats.played = (stats.played || 0) + 1;
  stats.streak = won ? (stats.streak || 0) + 1 : 0;
  stats.wins = (stats.wins || 0) + (won ? 1 : 0);
  localStorage.setItem(statsKey, JSON.stringify(stats));
  const summary = document.getElementById("summary");
  summary.textContent += `\nPlayed: ${stats.played}\nWins: ${stats.wins}\nStreak: ${stats.streak}`;
}

function shareResult() {
  const result = gameComplete ? (revealedLetters.every(v => v) ? "Solved" : "Fail") : "In Progress";
  const txt = `Reveal Game #${getDayIndex()}\n${result} in ${guesses.length} guesses, ${hintsUsed} hints.\nhttps://tracyp.revealgame.com`;
  navigator.clipboard.writeText(txt).then(() => alert("Copied to clipboard!"));
}

function startGame() {
  currentWord = getWordForToday();
  revealedLetters = new Array(currentWord.length).fill(null);
  hintOrder = Array.from(currentWord).map((_, i) => i).sort(() => Math.random() - 0.5);
  restoreGame();
  document.getElementById("modeIndicator").textContent = testingMode ? "Testing Mode" : "";
  renderKeyboard();
  updateHintsLeft();
  renderWord();
  if (gameComplete) {
    showWordComplete(revealedLetters.every(v => v));
  }
}

window.onload = startGame;
