// main.js

const testingMode = true;
const testingIntervalSeconds = 60;
const hintsRequiredBeforeAllowed = 3;

const encryptedWords = window.encryptedWords;
const passphraseBase = "base64";

let currentWord = { word: "", definition: "" };
let revealedLetters = [];
let hintOrder = [];
let hintsUsed = 0;
let maxHints = 3;
let gameComplete = false;
let incorrectGuesses = 0;
let totalGuesses = 0;
let gameState = "playing"; // can be "playing", "won", or "lost";

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
  const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);

  try {
    return JSON.parse(decryptedStr);
  } catch (e) {
    return {
      word: decryptedStr,
      definition: ""
    };
  }
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderWord() {
  const wordContainer = document.getElementById("word");
  wordContainer.innerHTML = ""; // Clear existing word
  const word = currentWord.word.toLowerCase();
  const definition = currentWord.definition;

  revealedLetters.forEach((status, idx) => {
    const letter = word[idx];
    const tile = document.createElement("div");
    tile.classList.add("tile");

    if (status === "correct") {
      tile.classList.add("correct-flash"); // Flash first
      setTimeout(() => {
        tile.classList.remove("correct-flash");
        tile.classList.add("correct");
      }, 400);
      tile.textContent = letter.toUpperCase();
    } else if (status === "hint") {
      tile.classList.add("hint-flash"); // Flash first
      setTimeout(() => {
        tile.classList.remove("hint-flash");
        tile.classList.add("hint");
      }, 400);
      tile.textContent = letter.toUpperCase();
    } else {
      tile.textContent = "";
    }

    wordContainer.appendChild(tile);
  });

  // Border for success/failure
  if (gameState === "won") {
    wordContainer.classList.remove("fail-border");
    wordContainer.classList.add("success-border");
  } else if (gameState === "lost") {
    wordContainer.classList.remove("success-border");
    wordContainer.classList.add("fail-border");
  } else {
    wordContainer.classList.remove("success-border", "fail-border");
  }

  // Definition display
  const defElement = document.getElementById("definition");
  if (definition) {
    const trimmed = definition.trim();
    const punctuation = [".", "!", "?", "…", ":", ";"];
    const lastChar = trimmed.slice(-1);
    const needsPeriod = !punctuation.includes(lastChar);
    defElement.textContent = trimmed + (needsPeriod ? "." : "");
  } else {
    defElement.textContent = "";
  }
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

function disableKey(letter, correct, isHint = false) {
  if (!letter) return;
  const key = document.getElementById(`key-${letter.toUpperCase()}`);
  if (key) {
    key.disabled = true;
    key.classList.remove("wrong", "correct", "hint");
    if (isHint) {
      key.classList.add("hint");
    } else {
      key.classList.add(correct ? "correct" : "wrong");
    }
  }
}

function handleGuess(letter) {
  if (gameComplete) return;

  const key = document.getElementById(`key-${letter.toUpperCase()}`);
  if (key.disabled) return;

  totalGuesses++;

  let found = false;
  currentWord.word.split("").forEach((char, i) => {
    if (char.toUpperCase() === letter.toUpperCase() && !revealedLetters[i]) {
      revealedLetters[i] = "correct";
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
  if (hintsUsed >= maxHints) {
    console.log(`[hint] Max hints used (${hintsUsed}/${maxHints}). No hint given.`);
    return false;
  }

  console.log(`[hint] Attempting to reveal hint. Current hintsUsed: ${hintsUsed}`);
  console.log(`[hint] Hint order:`, hintOrder);
  console.log(`[hint] Revealed letters:`, revealedLetters);

  for (let i = 0; i < hintOrder.length; i++) {
    const idx = hintOrder[i];
    const letter = currentWord.word[idx];
    const revealedStatus = revealedLetters[idx];

    console.log(`[hint] Checking index ${idx} (letter '${letter}') — revealed status: ${revealedStatus}`);

    if (!revealedStatus) {
      console.log(`[hint] Revealing hint at index ${idx} with letter '${letter}'`);
      revealedLetters[idx] = "hint";
      disableKey(letter, true, true); // hint key
      hintsUsed++;
      updateHintsLeft();
      renderWord();

      if (hintsUsed === maxHints) {
        console.log(`[hint] All ${maxHints} hints now used.`);
      }

      return true;
    }
  }

  console.warn("[hint] No valid unrevealed letter found for hint. All hint positions exhausted.");
  return false;
}

function updateHintsLeft() {
  const container = document.getElementById("hintsLeft");
  container.innerHTML = "";

  const pill = document.createElement("div");
  pill.id = "hintsLeftContainer";

  const label = document.createElement("span");
  label.textContent = "Hints";
  pill.appendChild(label);

  for (let i = 0; i < maxHints; i++) {
    const led = document.createElement("div");
    led.className = "hint-led";
    if (i < hintsUsed) led.classList.add("used");
    pill.appendChild(led);
  }

  container.appendChild(pill);
}

function showWordComplete(success) {
  gameComplete = true;
  gameState = success ? "won" : "lost";

  const summary = document.getElementById("summary");
  const wordWrapper = document.getElementById("wordWrapper");

  wordWrapper.classList.add("complete");
  wordWrapper.classList.remove("success", "failure");
  wordWrapper.classList.add(success ? "success" : "failure");

  const msg = success
    ? "Solved!"
    : `Fail\nWord was: ${currentWord.word.toUpperCase()}`;
  summary.textContent = msg;

  updateStats(success);
  disableAllKeys();
  fetchDefinition(currentWord.word);
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

function endsWithPunctuation(text) {
  // Common punctuation marks to check for at the end
  const punctuationMarks = [".", "!", "?", "…", ":", ";"];
  // Trim whitespace from end
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const lastChar = trimmed.charAt(trimmed.length - 1);
  return punctuationMarks.includes(lastChar);
}

function startGame() {
  document.getElementById("modeIndicator").textContent = testingMode ? "(Testing Mode)" : "";

  const index = getWordIndex();
  currentWord = decryptWord(index);

  if (!currentWord || typeof currentWord !== "object" || !currentWord.word || currentWord.word.length === 0) {
    console.error("[startGame] Failed to decrypt current word object.");
    return;
  }

  const storedIndex = parseInt(localStorage.getItem("playedIndex"));
  const storedRevealed = localStorage.getItem("revealedLetters");
  const storedHintsUsed = parseInt(localStorage.getItem("hintsUsed")) || 0;
  const storedComplete = localStorage.getItem("gameComplete") === "true";
  const storedHintOrder = JSON.parse(localStorage.getItem("hintOrder") || "[]");
  const storedIncorrect = parseInt(localStorage.getItem("incorrectGuesses")) || 0;
  const storedTotal = parseInt(localStorage.getItem("totalGuesses")) || 0;

  if (storedIndex === index && Array.isArray(JSON.parse(storedRevealed || "[]"))) {
    revealedLetters = JSON.parse(storedRevealed);
    if (revealedLetters.length !== currentWord.word.length) {
      console.warn("[startGame] Stored revealedLetters wrong length. Resetting.");
      revealedLetters = new Array(currentWord.word.length).fill("");
    }

    hintOrder = Array.isArray(storedHintOrder) && storedHintOrder.length === currentWord.word.length
      ? storedHintOrder
      : shuffle([...Array(currentWord.word.length).keys()]);
    hintsUsed = storedHintsUsed;
    incorrectGuesses = storedIncorrect;
    totalGuesses = storedTotal;
    gameComplete = storedComplete;

    console.log("[debug] Restored game state.");
    console.log("[debug] hintOrder:", hintOrder);
    console.log("[debug] revealedLetters:", revealedLetters);

    renderWord();
    updateHintsLeft();
    createKeyboard();
    showStats();
    if (gameComplete) disableAllKeys();
    return;
  }

  currentWord = decryptWord(index);
  revealedLetters = new Array(currentWord.word.length).fill("");
  hintOrder = shuffle([...Array(currentWord.word.length).keys()]);
  hintsUsed = 0;
  incorrectGuesses = 0;
  totalGuesses = 0;
  gameComplete = false;

  localStorage.setItem("playedIndex", index);
  localStorage.setItem("revealedLetters", JSON.stringify(revealedLetters));
  localStorage.setItem("hintOrder", JSON.stringify(hintOrder));
  localStorage.setItem("hintsUsed", "0");
  localStorage.setItem("gameComplete", "false");
  localStorage.setItem("incorrectGuesses", "0");
  localStorage.setItem("totalGuesses", "0");

  console.log("[debug] New hint order:", hintOrder);

  createKeyboard();
  renderWord();
  updateHintsLeft();
}

window.onload = startGame;
