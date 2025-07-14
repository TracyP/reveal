// Reveal game logic
const passphraseBase = "base64";
const testingMode = true; // toggle for fast word cycling
const testPeriodSeconds = 60; // 1-minute cycle

const maxHints = 3;
let usedHints = 0;
let currentWord = "";
let revealed = [];
let guessedLetters = {};
let keyButtons = {};

function getWordIndex() {
  const now = new Date();
  let epoch;
  if (testingMode) {
    epoch = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const secondsSince = Math.floor((now - epoch) / 1000);
    return secondsSince < encryptedWords.length ? secondsSince : encryptedWords.length + (secondsSince % encryptedWords.length);
  } else {
    epoch = Date.UTC(2024, 0, 1);
    const nowUTC = Date.now();
    return Math.floor((nowUTC - epoch) / 86400000);
  }
}

function decryptWord(index) {
  const encrypted = encryptedWords[index % encryptedWords.length];
  const key = passphraseBase + index;
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext;
  } catch {
    return "";
  }
}

function setupGame() {
  const index = getWordIndex();
  const saved = localStorage.getItem("played-" + index);
  currentWord = decryptWord(index);
  revealed = Array(currentWord.length).fill(null);
  guessedLetters = {};
  usedHints = 0;
  document.getElementById("modeIndicator").textContent = testingMode ? "[Testing Mode]" : "";
  renderWord();
  renderKeyboard();
  renderHints();

  if (saved === currentWord) {
    disableKeyboard();
    showStats(true);
  }
}

function renderWord() {
  const wordDiv = document.getElementById("word");
  wordDiv.innerHTML = "";
  revealed.forEach((letter, i) => {
    const span = document.createElement("div");
    span.className = "tile";
    if (letter === currentWord[i]) span.classList.add("correct");
    if (letter && letter !== currentWord[i]) span.classList.add("hint");
    span.textContent = letter || "";
    wordDiv.appendChild(span);
  });
}

function renderKeyboard() {
  const keys = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const kb = document.getElementById("keyboard");
  kb.innerHTML = "";
  keyButtons = {};

  keys.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyrow";
    row.split("").forEach(letter => {
      const btn = document.createElement("button");
      btn.textContent = letter;
      btn.className = "key";
      if (guessedLetters[letter] === "correct") btn.classList.add("correct");
      else if (guessedLetters[letter] === "wrong") btn.classList.add("wrong");
      else if (guessedLetters[letter] === "hint") btn.classList.add("hintkey");
      btn.onclick = () => handleGuess(letter);
      keyButtons[letter] = btn;
      rowDiv.appendChild(btn);
    });
    kb.appendChild(rowDiv);
  });
}

function renderHints() {
  const hintsDiv = document.getElementById("hintsLeft");
  hintsDiv.innerHTML = "";
  for (let i = 0; i < maxHints; i++) {
    const led = document.createElement("div");
    led.className = "hint-led";
    if (i < usedHints) led.classList.add("used");
    hintsDiv.appendChild(led);
  }
}

function handleGuess(letter) {
  if (!currentWord || revealed.every(c => c)) return;

  if (guessedLetters[letter]) return;
  let found = false;

  currentWord.split("").forEach((l, i) => {
    if (l === letter) {
      revealed[i] = l;
      found = true;
    }
  });

  guessedLetters[letter] = found ? "correct" : "wrong";

  if (!found && usedHints < maxHints) {
    revealHint();
  } else if (!found && usedHints >= maxHints) {
    endGame(false);
    return;
  }

  renderWord();
  renderKeyboard();
  renderHints();

  if (revealed.every((l, i) => l === currentWord[i])) {
    endGame(true);
  }
}

function revealHint() {
  for (let i = 0; i < currentWord.length; i++) {
    if (!revealed[i]) {
      revealed[i] = currentWord[i];
      guessedLetters[currentWord[i]] = "hint";
      usedHints++;
      break;
    }
  }
}

function endGame(success) {
  disableKeyboard();
  const summary = document.getElementById("summary");
  summary.textContent = success ? "✅ Solved" : `❌ Fail. Word was: ${currentWord.toUpperCase()}`;
  if (success) launchConfetti();
  saveGame();
  showStats(success);
}

function disableKeyboard() {
  Object.values(keyButtons).forEach(btn => btn.disabled = true);
}

function saveGame() {
  const index = getWordIndex();
  localStorage.setItem("played-" + index, currentWord);
  localStorage.setItem("hints-" + index, usedHints);
  localStorage.setItem("result-" + index, revealed.join("") === currentWord ? "solved" : "fail");
}

function showStats(success) {
  const index = getWordIndex();
  const result = localStorage.getItem("result-" + index);
  const hints = localStorage.getItem("hints-" + index);
  const summary = document.getElementById("summary");
  summary.textContent = `${result === "solved" ? "✅ Solved" : "❌ Fail"}\nHints used: ${hints}`;
  document.getElementById("share").textContent = `Share puzzle #${index}`;
}

function shareResult() {
  const index = getWordIndex();
  const hints = localStorage.getItem("hints-" + index);
  const result = localStorage.getItem("result-" + index);
  const msg = `Reveal puzzle #${index}: ${result === "solved" ? "Solved" : "Fail"} with ${hints} hint(s)! play at: [your-url]`;
  navigator.clipboard.writeText(msg).then(() => alert("Result copied to clipboard!"));
}

function launchConfetti() {
  // Confetti.js or placeholder — kept minimal for now
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = "#4caf50";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 300);
}

window.onload = setupGame;
