"use strict";

const maxHints = 3;
let hintsUsed = 0;
let gameComplete = false;
let solved = false;

const wordWrapper = document.getElementById("wordWrapper");
const wordDiv = document.getElementById("word");
const keyboardDiv = document.getElementById("keyboard");
const summaryDiv = document.getElementById("summary");
const shareDiv = document.getElementById("share");
const hintsLeftDiv = document.getElementById("hintsLeft");
const modeIndicator = document.getElementById("modeIndicator");

let keyButtons = {};
let currentWord = "";
let revealedLetters = [];
let hintOrder = [];
let guesses = [];
let startTime;
let endTime;

// CONFIGURATION
const testingMode = false;  // Toggle to true for 1-minute rapid test
const wordListLength = encryptedWords.length;

const epochDateStr = "2025-07-14T00:00:00"; // Local midnight start
const wordDurationMinutes = testingMode ? 1 : 1440; // 1 min for test, else daily

function decryptWord(encStr, index) {
  const key = "base64" + index.toString();
  try {
    const decrypted = CryptoJS.AES.decrypt(encStr, key).toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error("Decryption failed or empty");
    return decrypted.toUpperCase();
  } catch (e) {
    console.error("Decryption error:", e);
    return null;
  }
}

function getDayIndex() {
  const now = new Date();
  const epoch = new Date(epochDateStr);
  const elapsedMs = now - epoch;
  const elapsedMins = Math.floor(elapsedMs / 60000);
  return Math.floor(elapsedMins / wordDurationMinutes);
}

function getWordIndex() {
  const dayIndex = getDayIndex();
  if (dayIndex < wordListLength) return dayIndex;
  return dayIndex % wordListLength;
}

function loadWord() {
  const idx = getWordIndex();
  const decrypted = decryptWord(encryptedWords[idx], idx);
  if (!decrypted) {
    alert("Failed to decrypt word.");
    return null;
  }
  return decrypted;
}

function initHintOrder(word) {
  const indices = Array.from(word).map((_, i) => i);
  const seed = word.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = (seed + i * i) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function buildKeyboard() {
  keyboardDiv.innerHTML = "";
  keyButtons = {};
  const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  rows.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyrow";
    for (const letter of row) {
      const btn = document.createElement("button");
      btn.className = "key";
      btn.textContent = letter;
      btn.dataset.letter = letter;
      btn.addEventListener("click", () => handleGuess(letter));
      rowDiv.appendChild(btn);
      keyButtons[letter] = btn;
    }
    keyboardDiv.appendChild(rowDiv);
  });
}

function disableKeyboard() {
  Object.values(keyButtons).forEach(btn => {
    btn.disabled = true;
    btn.classList.add("disabled");
  });
}

function disableKey(letter) {
  const btn = keyButtons[letter];
  if (!btn) return;
  btn.disabled = true;
  btn.classList.add("hintkey");
}

function renderWord() {
  wordDiv.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = revealedLetters[i] ? currentWord[i] : "";
    if (revealedLetters[i] === "correct") tile.classList.add("correct");
    else if (revealedLetters[i] === "hint") tile.classList.add("hint");
    wordDiv.appendChild(tile);
  }
}

function updateHintsLeft() {
  hintsLeftDiv.innerHTML = "";
  for (let i = 0; i < maxHints; i++) {
    const led = document.createElement("div");
    led.className = "hint-led" + (i < hintsUsed ? " used" : "");
    hintsLeftDiv.appendChild(led);
  }
}

function updateSummary() {
  if (!gameComplete) {
    summaryDiv.textContent = "";
    shareDiv.textContent = "";
    return;
  }
  const durationSeconds = Math.floor((endTime - startTime) / 1000);
  const correctCount = revealedLetters.filter(v => v === "correct").length;
  const hintCount = revealedLetters.filter(v => v === "hint").length;
  let resultText = solved ? "Solved" : "Fail";
  summaryDiv.textContent = 
    `${resultText}\nCorrect letters: ${correctCount}\nHints used: ${hintCount}\nDuration: ${durationSeconds}s\nPuzzle #: ${getDayIndex()}`;
  shareDiv.textContent = "Share your result";
}

function showWordComplete(success) {
  gameComplete = true;
  solved = success;
  endTime = new Date();
  wordWrapper.classList.add("complete");
  disableKeyboard();
  updateSummary();
  if (success) {
    startConfetti();
  } else {
    startFailEffect();
  }
  renderWord();
}

function startConfetti() {
  // Implement your confetti here or keep this as placeholder
  console.log("Confetti!");
}

function startFailEffect() {
  wordWrapper.style.animation = "shake 0.5s";
  setTimeout(() => { wordWrapper.style.animation = ""; }, 500);
}

function revealHint() {
  if (hintsUsed >= maxHints) return false;
  const idx = hintOrder[hintsUsed];
  if (revealedLetters[idx]) return false; 
  revealedLetters[idx] = "hint";
 
