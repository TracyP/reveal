// main.js

const testingMode = true; // Set to true to rotate word every minute for testing
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

function disableKey(letter) {
  const key = document.getElementById(`key-${letter.toUpperCase()}`);
  if (key) {
    key.disabled = true;
    key.classList.add("hintkey");
  }
}

function handleGuess(letter) {
  // if (gameComplete || revealedLetters.includes("")) return;
  if (gameComplete) return;
  const guessCount = revealedLetters.filter(x => x === "guess").length;
  let found = false;
  currentWord.split("").forEach((char, i) => {
    if (char.toUpperCase() === letter.toUpperCase() && !revealedLetters[i]) {
      revealedLetters[i] = "guess";
      disableKey(letter);
      found = true;
    }
  });
  if (!found && guessCount >= hintsRequiredBeforeAllowed) {
    revealHint();
  }
  renderWord();
  if (revealedLetters.every(x => x)) {
    showWordComplete(true);
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
    setTimeout(() => showWordComplete(false), 500);
  }
  return true;
}

function updateHintsLeft() {
  const el = document.getElementById("hintsLeft");
  el.innerHTML = "";
  for (let i = 0; i < maxHints; i++) {
    const led = document.createElement("div");
    led.className = "hint-led";
    if (i < hintsUsed) led.classList.add("used");
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
    renderWord();
    updateHintsLeft();
    showStats();
    if (gameComplete) disableAllKeys();
    return;
  }

  revealedLetters = new Array(currentWord.length).fill("");
  hintOrder = shuffle([...Array(currentWord.length).keys()]);
  hintsUsed = 0;
  gameComplete = false;
  localStorage.setItem("playedIndex", index);
  localStorage.setItem("revealedLetters", JSON.stringify(revealedLetters));
  localStorage.setItem("hintsUsed", "0");
  localStorage.setItem("gameComplete", "false");

  createKeyboard();
  renderWord();
  updateHintsLeft();
}

window.onload = startGame;
