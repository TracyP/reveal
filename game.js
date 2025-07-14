// game.js (updated version)

// Configurable Flags
const TESTING_MODE = false;
const TESTING_INTERVAL_MINUTES = 1;
const TESTING_ANCHOR_MINUTE = 0;
const epoch = new Date(2023, 0, 1, 0, 0, 0); // Jan 1, 2023 local time

const passphrase = "base64";
let currentWord = "";
let revealedLetters = [];
let guessedLetters = [];
let hintOrder = [];
let hintsUsed = 0;
const maxHints = 3;
let guessesMade = 0;
let completed = false;
const keyButtons = {}; // To track key button DOM references

function getPuzzleIndex() {
  const now = new Date();
  if (TESTING_MODE) {
    const minutesSinceHour = now.getMinutes() - TESTING_ANCHOR_MINUTE;
    return minutesSinceHour >= 0 ? minutesSinceHour : 0;
  } else {
    const msPerDay = 86400000;
    return Math.floor((now - epoch) / msPerDay);
  }
}

function getEncryptedWord(index) {
  if (index < encryptedWords.length) {
    return encryptedWords[index];
  }
  const pseudoRandomIndex = index % encryptedWords.length;
  return encryptedWords[pseudoRandomIndex];
}

function decryptWord(index) {
  const key = passphrase + index;
  const encrypted = getEncryptedWord(index);
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function createTile(letter, status = "") {
  const tile = document.createElement("div");
  tile.className = "tile" + (status ? ` ${status}` : "");
  tile.textContent = letter;
  return tile;
}

function renderWord() {
  const container = document.getElementById("word");
  container.innerHTML = "";
  currentWord.split("").forEach((ch, idx) => {
    const status = revealedLetters[idx];
    const tile = createTile(status ? ch : "", status);
    tile.style.animationDelay = `${idx * 500}ms`;
    container.appendChild(tile);
  });
}

function disableKey(letter) {
  const key = keyButtons[letter.toUpperCase()];
  if (key) key.classList.add("hintkey");
}

function updateHintsLeft() {
  const hints = document.getElementById("hintsLeft");
  hints.innerHTML = "";
  for (let i = 0; i < maxHints; i++) {
    const led = document.createElement("div");
    led.className = "hint-led" + (i < hintsUsed ? " used" : "");
    hints.appendChild(led);
  }
}

function revealHint() {
  if (hintsUsed >= maxHints) return false;
  const idx = hintOrder[hintsUsed];
  if (revealedLetters[idx]) return false;
  revealedLetters[idx] = "hint";
  disableKey(currentWord[idx]);
  hintsUsed++;
  updateHintsLeft();
  renderWord();
  if (hintsUsed === maxHints) {
    showWordComplete(false);
  }
  return true;
}

function processGuess(letter) {
  if (completed || guessedLetters.includes(letter)) return;
  guessedLetters.push(letter);
  guessesMade++;
  const match = currentWord.includes(letter);
  if (match) {
    currentWord.split("").forEach((ch, idx) => {
      if (ch === letter) revealedLetters[idx] = "correct";
    });
    keyButtons[letter].classList.add("correct");
  } else {
    keyButtons[letter].classList.add("wrong");
    if (guessesMade > 3) {
      if (!revealHint()) {
        showWordComplete(false);
        return;
      }
    }
  }
  renderWord();
  checkCompletion();
}

function checkCompletion() {
  if (revealedLetters.every(s => s === "correct")) {
    showWordComplete(true);
  }
}

function showWordComplete(solved) {
  completed = true;
  localStorage.setItem("played-" + getPuzzleIndex(), solved ? "solved" : "fail");
  document.getElementById("wordWrapper").classList.add("complete");
  Object.values(keyButtons).forEach(btn => btn.disabled = true);
  renderWord();
  updateSummary(solved);
  fetchDefinition(currentWord);
}

function updateSummary(solved) {
  const summary = document.getElementById("summary");
  const status = solved ? "Solved" : "Fail";
  summary.textContent = `${status}  \nCorrect: ${revealedLetters.filter(s => s === "correct").length}  \nHints: ${hintsUsed}`;
}

function fetchDefinition(word) {
  fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
    .then(res => res.json())
    .then(data => {
      const def = data[0]?.meanings[0]?.definitions[0]?.definition;
      if (def) document.getElementById("definition").textContent = `\u{1F4D6} ${def}`;
    })
    .catch(() => {
      document.getElementById("definition").textContent = "No definition found.";
    });
}

function shareResult() {
  const idx = getPuzzleIndex();
  const time = new Date().toLocaleTimeString();
  const solved = revealedLetters.every(s => s === "correct");
  const message = `Reveal ${idx} - ${solved ? "Solved" : "Fail"}\nCorrect: ${revealedLetters.filter(s => s === "correct").length}\nHints: ${hintsUsed}\nPlayed at ${time}\nhttps://your-game-url`;
  navigator.clipboard.writeText(message).then(() => {
    alert("Result copied to clipboard!");
  });
}

function buildKeyboard() {
  const kb = document.getElementById("keyboard");
  kb.innerHTML = "";
  const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  rows.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyrow";
    row.split("").forEach(letter => {
      const btn = document.createElement("button");
      btn.textContent = letter;
      btn.className = "key";
      btn.onclick = () => processGuess(letter);
      keyButtons[letter] = btn;
      rowDiv.appendChild(btn);
    });
    kb.appendChild(rowDiv);
  });
}

function loadStatsIfPlayed() {
  const result = localStorage.getItem("played-" + getPuzzleIndex());
  if (result) {
    completed = true;
    revealedLetters = currentWord.split("").map((_, i) => result === "solved" ? "correct" : "hint");
    renderWord();
    Object.values(keyButtons).forEach(btn => btn.disabled = true);
    updateSummary(result === "solved");
    updateHintsLeft();
    fetchDefinition(currentWord);
  }
}

function startGame() {
  const idx = getPuzzleIndex();
  currentWord = decryptWord(idx).toUpperCase();
  revealedLetters = new Array(currentWord.length).fill(null);
  hintOrder = [...Array(currentWord.length).keys()].sort(() => Math.random() - 0.5);
  buildKeyboard();
  updateHintsLeft();
  document.getElementById("modeIndicator").textContent = TESTING_MODE ? "Testing Mode" : "";
  renderWord();
  loadStatsIfPlayed();
}

window.onload = startGame;
