let problems = [];
let filtered = [];

let currentIndex = 0;
let topic = "All";
let difficulty = "All";
let subtopic = "All";

let solved = new Set();

// Load problems locally
fetch(chrome.runtime.getURL("problems.json"))
  .then((res) => res.json())
  .then((data) => {
    problems = data;
    loadState();
  })
  .catch((err) => console.error("Error loading problems:", err));

// Apply filters
function applyFilters() {
  filtered = problems.filter(
    (p) =>
      (topic === "All" || p.Topic === topic) &&
      (difficulty === "All" || p.Difficulty === difficulty) &&
      (subtopic === "All" || p.Subtopic === subtopic),
  );

  if (currentIndex >= filtered.length) currentIndex = 0;
}

// Open problem
function openCurrent() {
  const p = filtered[currentIndex];
  if (!p) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { url: p.Link });
    }
  });
}

// Navigation
function nextProblem() {
  if (currentIndex < filtered.length - 1) {
    currentIndex++;
    saveState();
    openCurrent();
    notify();
  }
}

function prevProblem() {
  if (currentIndex > 0) {
    currentIndex--;
    saveState();
    openCurrent();
    notify();
  }
}

// Toggle solved
function toggleSolved(index) {
  const key = filtered[index]?.Link;
  if (!key) return;

  if (solved.has(key)) solved.delete(key);
  else solved.add(key);

  saveState();
  notify();
}

// Progress
function getProgress() {
  if (!filtered.length) return 0;
  const count = filtered.filter((p) => solved.has(p.Link)).length;
  return Math.round((count / filtered.length) * 100);
}

// Dynamic icon generated from canvas
function updateIcon() {
  const p = filtered[currentIndex];
  if (!p) return;

  const isSolved = solved.has(p.Link);
  const size = 32;

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = isSolved ? "#4caf50" : "#9e9e9e";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "white";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Adding slight offset to perfectly center the text vertically
  ctx.fillText(isSolved ? "✓" : "•", size / 2, size / 2 + 2);

  chrome.action.setIcon({
    imageData: ctx.getImageData(0, 0, size, size),
  });
}

// Save / Load Storage
function saveState() {
  chrome.storage.local.set({
    currentIndex,
    topic,
    difficulty,
    subtopic,
    solved: Array.from(solved),
  });
}

function loadState() {
  chrome.storage.local.get(
    ["currentIndex", "topic", "difficulty", "subtopic", "solved"],
    (res) => {
      if (res.currentIndex !== undefined) currentIndex = res.currentIndex;
      if (res.topic) topic = res.topic;
      if (res.difficulty) difficulty = res.difficulty;
      if (res.subtopic) subtopic = res.subtopic;
      if (res.solved) solved = new Set(res.solved);

      applyFilters();
      notify();
    },
  );
}

// Notify popup & update icon
function notify() {
  // updateIcon();

  chrome.runtime
    .sendMessage({
      type: "STATE_UPDATED",
      currentIndex,
      filtered,
      solved: Array.from(solved),
      progress: getProgress(),
      topic,
      difficulty,
      subtopic,
    })
    .catch(() => {
      // Catch error quietly if popup is closed
    });
}

// Message Listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "NEXT") nextProblem();
  if (msg.type === "PREV") prevProblem();

  if (msg.type === "JUMP_TO") {
    currentIndex = msg.index;
    saveState();
    openCurrent();
    notify();
  }

  if (msg.type === "TOGGLE_SOLVED") {
    toggleSolved(msg.index);
  }

  if (msg.type === "SET_FILTERS") {
    topic = msg.topic;
    difficulty = msg.difficulty;
    subtopic = msg.subtopic;
    currentIndex = 0;

    applyFilters();
    saveState();
    notify();
  }

  if (msg.type === "GET_STATE") {
    sendResponse({
      currentIndex,
      filtered,
      solved: Array.from(solved),
      progress: getProgress(),
      topic,
      difficulty,
      subtopic,
    });
  }

  return true; // Keep message channel open for sendResponse
});
