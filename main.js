// main.js

const testingMode = true;
const testingIntervalSeconds = 60;
const hintsRequiredBeforeAllowed = 3;

const encryptedWords = window.encryptedWords;
const passphraseBase = "base64";

let currentWord = "";
let revealedLetters = [];
let hintOrder = [];
let hintsUsed = 0;
let maxHints = 3;
let gameComplete = false;
let incorrectGuesses = 0;
let totalGuesses = 0;

function getWordIndex() {
  const now = new Date();
  if (testingMode) {
    const minutesSinceHour = now.getMinutes();
    if (minutesSinceHour < encryptedWords.length) return minutesSinceHour;
    const seed = now.getHours() * 60 + now.getMinutes();
    return seed % encryptedWords.length;
  } else {
    const epoch = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSinceEpoch = Math.floor((now - epoch) / (1000 * 60 * 60 * 24));
    if (daysSinceEpoch < encryptedWords.length) return daysSinceEpoch;
    return (daysSinceEpoch * 37) % encryptedWords.length;
  }
}

function decryptWord(index) {
  const encrypted = encryptedWords[index];
  const passphrase = passphraseBase + index;
  const bytes = CryptoJS.AES.decrypt(encrypted, passphrase);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderWord() {
  const wordEl = document.getElementById("word");
  wordEl.innerHTML = "";
  currentWord.split("").forEach((char, i) => {
    const div = document.createElement("div");
    div.className = "tile";
    if (revealedLetters[i] === "guess") {
      div.classList.add("correct");
    } else if (revealedLetters[i] === "hint") {
      div.classList.add("hint");
    }
    div.textContent = revealedLetters[i] ? char.toUpperCase() : "";
    wordEl.appendChild(div);
  });
}

function createKeyboard() {
  const keyboard = document.getElementById("keyboard");
  keyboard.innerHTML = "";
  const layout = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  layout.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyrow";
    row.split("").forEach(letter => {
      const btn = document.createElement("button");
      btn.textContent = letter;
      btn.className = "key";
      btn.id = `key-${letter}`;
      btn.onclick = () => handleGuess(letter);
      rowDiv.appendChild(btn);
    });
    keyboard.appendChild(rowDiv);
  });
}

function disableKey(letter, correct) {
  if (!letter) return; // guard against undefined
  const key = document.getElementById(`key-${letter.toUpperCase()}`);
  if (key) {
    key.disabled = true;
    key.classList.remove("wrong", "correct");
    key.classList.add(correct ? "correct" : "wrong");
  }
}

function handleGuess(letter) {
  if (gameComplete) return;

  const key = document.getElementById(`key-${letter.toUpperCase()}`);
  if (key.disabled) return;

  totalGuesses++;

  let found = false;
  currentWord.split("").forEach((char, i) => {
    if (char.toUpperCase() === letter.toUpperCase() && !revealedLetters[i]) {
      revealedLetters[i] = "guess";
      found = true;
    }
  });

  if (found) {
    disableKey(letter, true);
  } else {
    incorrectGuesses++;
    disableKey(letter, false);

    if (hintsUsed >= maxHints) {
      showWordComplete(false); // Too many mistakes
      return;
    }

    if (totalGuesses >= hintsRequiredBeforeAllowed) {
      revealHint(); // Only allow hinting after 3 total guesses
    }
  }

  renderWord();

  if (revealedLetters.every(x => x)) {
    showWordComplete(true);
  }
}

function revealHint() {
  if (hintsUsed >= maxHints) return false;

  // Loop through hintOrder starting from current hintsUsed
  while (hintsUsed < maxHints && hintOrder.length > 0) {
    const idx = hintOrder[hintsUsed];

    if (!revealedLetters[idx]) {
      // Valid unrevealed letter found — reveal it
      revealedLetters[idx] = "hint";
      disableKey(currentWord[idx], true);
      hintsUsed++;
      updateHintsLeft();
      renderWord();
      return true;
    } else {
      // Skip this one — already revealed by user
      hintsUsed++;
    }
  }

  // If we get here, we ran out of useful hint positions
  console.warn("No valid unrevealed letter found for hint.");
  return false;
}

function updateHintsLeft() {
  const el = document.getElementById("hintsLeft");
  el.innerHTML = "";
  for (let i = 0; i < maxHints; i++) {
    const led = document.createElement("div");
    led.className = "hint-led";
    if (i < hintsUsed) {
      led.classList.add("used"); // red
    } else {
      led.classList.add("active"); // green
    }
    el.appendChild(led);
  }
}

function showWordComplete(success) {
  gameComplete = true;
  const summary = document.getElementById("summary");
  const wordWrapper = document.getElementById("wordWrapper");
  wordWrapper.classList.add("complete");
  const msg = success ? "Solved!" : `Fail\nWord was: ${currentWord.toUpperCase()}`;
  summary.textContent = msg;
  updateStats(success);
  disableAllKeys();
  fetchDefinition(currentWord);
}

function disableAllKeys() {
  document.querySelectorAll(".key").forEach(btn => btn.disabled = true);
}

function fetchDefinition(word) {
  fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
    .then(res => res.json())
    .then(data => {
      const definition = data[0]?.meanings[0]?.definitions[0]?.definition || "(no definition found)";
      document.getElementById("definition").textContent = `${word.charAt(0).toUpperCase() + word.slice(1)}: ${definition}.`;
    });
}

function updateStats(success) {
  const stats = JSON.parse(localStorage.getItem("revealStats") || "{\"played\":0,\"solved\":0}");
  stats.played++;
  if (success) stats.solved++;
  localStorage.setItem("revealStats", JSON.stringify(stats));
}

function showStats() {
  const stats = JSON.parse(localStorage.getItem("revealStats") || "{\"played\":0,\"solved\":0}");
  const summary = document.getElementById("summary");
  summary.textContent += `\nGames played: ${stats.played}\nSolved: ${stats.solved}`;
}

function shareResult() {
  const summary = document.getElementById("summary").textContent;
  navigator.clipboard.writeText(`Reveal\n${summary}\nhttps://yourgameurl.com`).then(() => {
    alert("Result copied to clipboard!");
  });
}

function startGame() {
  document.getElementById("modeIndicator").textContent = testingMode ? "(Testing Mode)" : "";
  const index = getWordIndex();
  currentWord = decryptWord(index);

  const storedIndex = parseInt(localStorage.getItem("playedIndex"));
  if (storedIndex === index) {
    revealedLetters = JSON.parse(localStorage.getItem("revealedLetters"));
    hintsUsed = parseInt(localStorage.getItem("hintsUsed")) || 0;
    gameComplete = localStorage.getItem("gameComplete") === "true";
    incorrectGuesses = parseInt(localStorage.getItem("incorrectGuesses")) || 0;
    totalGuesses = parseInt(localStorage.getItem("totalGuesses")) || 0;
    renderWord();
    updateHintsLeft();
    showStats();
    if (gameComplete) disableAllKeys();
    createKeyboard();
    return;
  }

  revealedLetters = new Array(currentWord.length).fill("");
  hintOrder = shuffle([...Array(currentWord.length).keys()]);
  hintsUsed = 0;
  incorrectGuesses = 0;
  totalGuesses = 0;
  gameComplete = false;
  localStorage.setItem("playedIndex", index);
  localStorage.setItem("revealedLetters", JSON.stringify(revealedLetters));
  localStorage.setItem("hintsUsed", "0");
  localStorage.setItem("gameComplete", "false");
  localStorage.setItem("incorrectGuesses", "0");
  localStorage.setItem("totalGuesses", "0");

  createKeyboard();
  renderWord();
  updateHintsLeft();
}

window.onload = startGame;
