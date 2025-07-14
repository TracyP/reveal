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
const testingMode = false;  // Set true for rapid tests
const wordListLength = encryptedWords.length;

// Epoch & word timing controls
const epochDateStr = "2025-07-14T00:00:00"; // Local daily epoch start
const wordDurationMinutes = testingMode ? 1 : 1440; // 1 min test, else 1 day

// --- Initialization ---

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
  // Calculate minutes since epoch aligned to hour start (minute 0)
  const elapsedMs = now - epoch;
  const elapsedMins = Math.floor(elapsedMs / 60000);
  // floor to nearest multiple of wordDurationMinutes
  return Math.floor(elapsedMins / wordDurationMinutes);
}

function getWordIndex() {
  const dayIndex = getDayIndex();
  if (dayIndex < wordListLength) return dayIndex;
  // Use modulo for repeated pseudo random phase
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
  // Simple fixed order: shuffle indices deterministically by word
  const indices = Array.from(word).map((_, i) => i);
  // Shuffle using seed from word char codes
  const seed = word.split("").reduce((a,c) => a + c.charCodeAt(0), 0);
  for (let i = indices.length -1; i > 0; i--) {
    const j = (seed + i*i) % (i+1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

// --- Build Keyboard ---

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
      btn.textContent = letter.toUpperCase();
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

// --- Update UI ---

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
  const durationSeconds = Math.floor((endTime - startTime) / 1000);
  const correctCount = revealedLetters.filter(v => v === "correct").length;
  const hintCount = revealedLetters.filter(v => v === "hint").length;
  let resultText = solved ? "Solved" : "Fail";
  summaryDiv.textContent = 
    `${resultText}\nCorrect letters: ${correctCount}\nHints used: ${hintCount}\nDuration: ${durationSeconds}s\nPuzzle #: ${getDayIndex()}`;
}

// --- Game Logic ---

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
  renderHints();
}

function startConfetti() {
  // Confetti code or placeholder
  // For brevity, no actual confetti here, you can add library if desired
  console.log("Confetti!");
}

function startFailEffect() {
  // Could do a shake or flash red background on #wordWrapper
  wordWrapper.style.animation = "shake 0.5s";
  setTimeout(() => { wordWrapper.style.animation = ""; }, 500);
}

function revealHint() {
  if (hintsUsed >= maxHints) return false;
  const idx = hintOrder[hintsUsed];
  if (revealedLetters[idx]) return false; // already revealed
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

function handleGuess(letter) {
  if (gameComplete) return;
  letter = letter.toUpperCase();

  // Ignore if already guessed or hinted
  if (guesses.includes(letter) || Object.keys(keyButtons).includes(letter) && keyButtons[letter].disabled) return;

  guesses.push(letter);

  if (currentWord.includes(letter)) {
    // Correct guess
    for (let i = 0; i < currentWord.length; i++) {
      if (currentWord[i] === letter) {
        revealedLetters[i] = "correct";
      }
    }
    keyButtons[letter].classList.add("correct");
  } else {
    // Incorrect guess, show hint if available
    keyButtons[letter].classList.add("wrong");
    if (hintsUsed < maxHints) {
      revealHint();
    } else {
      showWordComplete(false);
    }
  }

  renderWord();
  updateHintsLeft();
  checkComplete();
}

function checkComplete() {
  if (revealedLetters.every(v => v === "correct" || v === "hint")) {
    showWordComplete(true);
  }
}

function shareResult() {
  if (!gameComplete) return;
  const durationSeconds = Math.floor((endTime - startTime) / 1000);
  const correctCount = revealedLetters.filter(v => v === "correct").length;
  const hintCount = revealedLetters.filter(v => v === "hint").length;
  const puzzleNum = getDayIndex();

  const text = `Reveal Puzzle #${puzzleNum} - ${solved ? "Solved" : "Fail"}\n` +
    `Correct letters: ${correctCount}, Hints used: ${hintCount}, Time: ${durationSeconds}s\n` +
    `Try it yourself at: https://yourdomain/reveal`; // Replace with your real URL

  if (navigator.share) {
    navigator.share({ text }).catch(console.error);
  } else {
    prompt("Copy your result to share:", text);
  }
}

// --- State Save/Load ---

function saveGame() {
  if (!gameComplete) return;
  const data = {
    wordIndex: getWordIndex(),
    revealedLetters,
    hintsUsed,
    guesses,
    solved,
    duration: Math.floor((endTime - startTime) / 1000),
    timestamp: Date.now()
  };
  localStorage.setItem("revealGameSave", JSON.stringify(data));
}

function loadGame() {
  const dataStr = localStorage.getItem("revealGameSave");
  if (!dataStr) return false;
  try {
    const data = JSON.parse(dataStr);
    if (data.wordIndex !== getWordIndex()) return false; // Different puzzle
    revealedLetters = data.revealedLetters;
    hintsUsed = data.hintsUsed;
    guesses = data.guesses;
    solved = data.solved;
    gameComplete = true;
    startTime = new Date(Date.now() - (data.duration * 1000));
    endTime = new Date();
    updateHintsLeft();
    renderWord();
    buildKeyboard();
    disableKeyboard();
    // Mark keys guessed/wrong/hint
    guesses.forEach(l => {
      if (revealedLetters.some((v,i) => currentWord[i] === l && v === "correct")) {
        keyButtons[l].classList.add("correct");
      } else if (revealedLetters.some((v,i) => currentWord[i] === l && v === "hint")) {
        keyButtons[l].classList.add("hintkey");
        keyButtons[l].disabled = true;
      } else {
        keyButtons[l].classList.add("wrong");
      }
    });
    updateSummary();
    return true;
  } catch {
    return false;
  }
}

function clearGameSave() {
  localStorage.removeItem("revealGameSave");
}

// --- Main ---

function startGame() {
  currentWord = loadWord();
  if (!currentWord) return;
  revealedLetters = new Array(currentWord.length).fill(null);
  hintOrder = initHintOrder(currentWord);
  guesses = [];
  hintsUsed = 0;
  gameComplete = false;
  solved = false;
  startTime = new Date();
  endTime = null;
  wordWrapper.classList.remove("complete");
  summaryDiv.textContent = "";
  shareDiv.textContent = "";
  updateHintsLeft();
  buildKeyboard();
  renderWord();
  modeIndicator.textContent = testingMode ? "Testing Mode: New word every minute" : "Production Mode: New word daily";
  // Try loading saved game:
  if (loadGame()) {
    // Show saved state instead of fresh start
  }
}

window.onload = () => {
  startGame();
  // Save progress before unload if complete
  window.addEventListener("beforeunload", () => {
    if (gameComplete) saveGame();
  });
};
