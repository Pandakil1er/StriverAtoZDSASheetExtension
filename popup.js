let currentIndex = 0;
let filtered = [];
let solved = new Set();
let allProblems = [];

const listEl = document.getElementById("problem-list");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

const topicFilter = document.getElementById("topicFilter");
const difficultyFilter = document.getElementById("difficultyFilter");
const subtopicFilter = document.getElementById("subtopicFilter");
const themeToggle = document.getElementById("themeToggle");

// SVGs for solved/unsolved icons
const iconSolved = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const iconUnsolved = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`;

// --- Theme Logic ---
function initTheme() {
  const isDark = localStorage.getItem("theme") === "dark";
  if (isDark) document.documentElement.setAttribute("data-theme", "dark");
}
initTheme();

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const newTheme = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
});
// -------------------

function populateSubtopics(selectedTopic) {
  subtopicFilter.innerHTML = "";
  subtopicFilter.add(new Option("All", "All"));

  let relevant = allProblems;
  if (selectedTopic !== "All") {
    relevant = allProblems.filter((p) => p.Topic === selectedTopic);
  }

  const subtopics = [...new Set(relevant.map((p) => p.Subtopic))];
  subtopics.forEach((s) => {
    if (s) subtopicFilter.add(new Option(s, s));
  });
}

fetch("problems.json")
  .then((r) => r.json())
  .then((data) => {
    allProblems = data;

    const topics = [...new Set(data.map((p) => p.Topic))];
    const difficulties = [...new Set(data.map((p) => p.Difficulty))];

    topics.forEach((t) => topicFilter.add(new Option(t, t)));
    difficulties.forEach((d) => difficultyFilter.add(new Option(d, d)));

    populateSubtopics("All");

    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
      currentIndex = res.currentIndex;
      filtered = res.filtered;
      solved = new Set(res.solved);

      topicFilter.value = res.topic || "All";
      difficultyFilter.value = res.difficulty || "All";

      populateSubtopics(topicFilter.value);
      subtopicFilter.value = res.subtopic || "All";

      updateUI(res.progress);
    });
  });

function updateUI(progress) {
  listEl.innerHTML = "";

  const start = 0;
  const end = filtered.length;

  for (let i = start; i < end; i++) {
    const p = filtered[i];

    const div = document.createElement("div");
    div.className = "item";

    if (i === currentIndex) div.classList.add("current");
    else if (solved.has(p.Link)) div.classList.add("solved");
    else div.classList.add("unsolved");

    const row = document.createElement("div");
    row.className = "row";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = `${i + 1}. ${p.Problem}`;

    // Difficulty badge
    const badge = document.createElement("span");
    badge.className = "badge";

    if (p.Difficulty === "Easy") {
      badge.style.background = "var(--easy-bg)";
      badge.style.color = "var(--easy-text)";
    } else if (p.Difficulty === "Medium") {
      badge.style.background = "var(--med-bg)";
      badge.style.color = "var(--med-text)";
    } else {
      badge.style.background = "var(--hard-bg)";
      badge.style.color = "var(--hard-text)";
    }

    badge.textContent = p.Difficulty;

    // Toggle Button
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.innerHTML = solved.has(p.Link) ? iconSolved : iconUnsolved;
    btn.title = solved.has(p.Link) ? "Mark as unsolved" : "Mark as solved";

    btn.onclick = (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: "TOGGLE_SOLVED",
        index: i,
      });
    };

    row.appendChild(title);
    row.appendChild(badge);
    row.appendChild(btn);

    div.appendChild(row);

    div.onclick = () => {
      chrome.runtime.sendMessage({
        type: "JUMP_TO",
        index: i,
      });
    };

    listEl.appendChild(div);
  }

  progressBar.style.width = progress + "%";
  progressText.textContent = `Progress: ${progress}%`;

  // Smooth scroll to current without jarring the user
  setTimeout(() => {
    const el = document.querySelector(".current");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
}

// Live updates from background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATE_UPDATED") {
    currentIndex = msg.currentIndex;
    filtered = msg.filtered;
    solved = new Set(msg.solved);

    topicFilter.value = msg.topic;
    difficultyFilter.value = msg.difficulty;

    // Only repopulate if topic changed to avoid UI jank
    if (
      subtopicFilter.options[1]?.value !== "All" &&
      topicFilter.value === "All"
    ) {
      populateSubtopics(msg.topic);
    }
    subtopicFilter.value = msg.subtopic;

    updateUI(msg.progress);
  }
});

// Filters
function updateFilters() {
  chrome.runtime.sendMessage({
    type: "SET_FILTERS",
    topic: topicFilter.value,
    difficulty: difficultyFilter.value,
    subtopic: subtopicFilter.value,
  });
}

topicFilter.onchange = () => {
  populateSubtopics(topicFilter.value);
  subtopicFilter.value = "All";
  updateFilters();
};

difficultyFilter.onchange = updateFilters;
subtopicFilter.onchange = updateFilters;
