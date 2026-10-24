import "./style.css";
import { WORLDS, FRIENDS, ALL_TASKS, STORAGE_KEY } from "./content.js";
import {
  loadProgress,
  freshProgress,
  completeTask,
  worldOpen,
} from "./progress.js";
import { icon, portrait } from "./icons.js";
import { speak, stopSpeech, chime } from "./audio.js";
import { World } from "./world.js";
import { World2D } from "./world-2d.js";

const $ = (s) => document.querySelector(s);
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let browserStorage;
try {
  browserStorage = window.localStorage;
} catch {
  // Reading remains available when browser storage is disabled.
}
const progress = loadProgress(browserStorage, STORAGE_KEY);
let game,
  started = false,
  modalKind = "",
  currentTask = null,
  selected = [],
  rewardTask = null,
  toastTimer,
  recognition,
  previousFocus;
let socket = null,
  roomCode = "",
  ownId = "",
  roomPlayers = [],
  lastSent = 0;
const app = $("#app");
app.innerHTML = `
  <aside class="rail" aria-label="Main navigation">
    <button class="brand-mark" data-action="welcome" aria-label="Maisie's Magic Kingdom">${icon("sparkles")}</button>
    <span class="rail-label">MAGIC<br>KINGDOM</span>
    <nav>
      <button class="rail-button active" data-action="explore" aria-label="Explore" title="Explore">${icon("leaf")}<span>Explore</span></button>
      <button class="rail-button" data-action="map" aria-label="World map" title="World map">${icon("map")}<span>Worlds</span></button>
      <button class="rail-button" data-action="journal" aria-label="Reading journal" title="Reading journal">${icon("book")}<span>My words</span></button>
      <button class="rail-button" data-action="friends" aria-label="Meet your friends" title="Meet your friends">${icon("heart")}<span>Friends</span></button>
    </nav>
    <div class="rail-bottom"><button class="rail-button" data-action="help" aria-label="How to play">${icon("help")}<span>Help</span></button><button class="parent-button" data-action="settings" title="Grown-up corner" aria-label="Grown-up corner">${icon("settings")}</button></div>
  </aside>
  <main class="game-shell">
    <div id="scene"></div>
    <div class="scene-vignette"></div>
    <header class="topbar">
      <button class="adventurer" data-action="journal">${portrait()}<span><strong>Maisie</strong><small>Little explorer <span class="level">· Level <b id="level">1</b></span></small></span></button>
      <div class="world-title"><span class="tiny-label">MAISIE & THE MAGIC KINGDOM</span><h1 id="world-name">Sunshine Meadow</h1><div class="world-subtitle"><span class="online-dot"></span><span id="world-focus">First sounds · Chapter 1 of 5</span></div></div>
      <div class="top-actions"><div class="counter stars" title="Reading stars">${icon("star")}<span id="stars">0</span><small>/ 12</small></div><div class="counter gems" title="Magic gems">${icon("gem")}<span id="gems">0</span></div><button class="round-button" id="sound-button" data-action="sound" aria-label="Mute sounds">${icon("sound")}</button></div>
    </header>
    <section class="quest-card" aria-label="Current quest">
      <div class="quest-heading"><span class="quest-symbol">${icon("flag")}</span><span class="tiny-label">YOUR LITTLE ADVENTURE</span><button data-action="narrate-quest" class="plain-icon" aria-label="Read quest aloud">${icon("sound")}</button></div>
      <h2 id="quest-title">A little reading magic</h2><p id="quest-description"></p>
      <div class="quest-progress"><div class="progress-track"><span id="quest-bar"></span></div><span id="quest-count">0 / 3</span></div>
      <div class="quest-goal" id="quest-goal"></div>
    </section>
    <button class="party-pill" data-action="party">${icon("users")}<span id="party-status">Play together</span><span class="small-plus">+</span></button>
    <div class="world-badge"><span id="world-icon">${icon("flower")}</span><div><small>YOU ARE EXPLORING</small><strong id="badge-world">Sunshine Meadow</strong></div></div>
    <div id="near-prompt" class="near-prompt hidden"><button data-action="interact"><span class="keycap">E</span><span id="near-text">Read a storybook</span>${icon("arrow")}</button></div>
    <div class="bottom-bar"><div class="companion"><span class="companion-portrait">${portrait("lily")}</span><div><strong>Lily is by your side</strong><span>Every little step is magic.</span></div><span class="heart-dot">${icon("heart")}</span></div><div class="keyboard-hints"><span><kbd>W A S D</kbd> Move</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>E</kbd> Read</span></div><button class="map-button" data-action="map">${icon("map")}<span>World map</span><kbd>M</kbd></button></div>
    <button class="minimap" data-action="map" aria-label="Open world map"><span class="map-north">N</span><svg viewBox="0 0 130 130" aria-hidden="true"><circle cx="65" cy="65" r="58" fill="#b5cc9b"/><path d="M65 105Q45 80 45 70T83 65T56 38L65 20" fill="none" stroke="#f4e4b7" stroke-width="9" stroke-linecap="round"/><circle cx="30" cy="35" r="9" fill="#7fa37b"/><circle cx="100" cy="85" r="10" fill="#88ab83"/><circle cx="100" cy="40" r="8" fill="#8fb287"/><g id="map-books"></g><path id="map-player" d="m0-6 4 11-4-2-4 2Z" fill="#fff" stroke="#4a6d59" stroke-width="1.5"/></svg><span class="minimap-caption">A world of possibilities</span></button>
    <div class="touch-controls"><div id="joystick" aria-label="Movement control"><span id="joystick-knob"></span></div><button id="touch-jump" aria-label="Jump">↑</button><button data-action="interact" aria-label="Read or talk">${icon("book")}</button></div>
  </main>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="modal-root"></div>
`;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    toast(
      "Your browser could not save. Keep this tab open to keep your adventure.",
    );
  }
}
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4300);
}
function narration(text, force = false) {
  return speak(text, progress.sound && (progress.narration || force));
}
function updateHUD() {
  const w = WORLDS[progress.world],
    done = w.tasks.filter((t) => progress.completed.includes(t.id)).length;
  $("#world-name").textContent = w.name;
  $("#world-focus").textContent =
    `${w.focus} · Chapter ${progress.world + 1} of 5`;
  $("#stars").textContent = progress.completed.length;
  $("#gems").textContent = progress.seeds.length;
  $("#level").textContent = 1 + Math.floor(progress.completed.length / 3);
  $("#world-icon").innerHTML = icon(w.icon);
  $("#badge-world").textContent = w.name;
  $("#quest-title").textContent =
    progress.world === 4
      ? "A star for a kind heart"
      : done === 3
        ? "A new world is waiting!"
        : [
            "A little reading magic",
            "Lovely little words",
            "A splash of reading",
            "Help Clover get home",
          ][progress.world];
  $("#quest-description").textContent = w.story;
  $("#quest-bar").style.width =
    `${w.tasks.length ? (done / 3) * 100 : progress.ending ? 100 : 0}%`;
  $("#quest-count").textContent = w.tasks.length
    ? `${done} / 3`
    : progress.ending
      ? "1 / 1"
      : "0 / 1";
  $("#quest-goal").innerHTML =
    progress.world === 4
      ? `${icon("star")} Meet Kit by the castle`
      : done === 3
        ? `<button data-action="map">${icon("sparkles")} Travel to ${WORLDS[progress.world + 1].name} ${icon("arrow")}</button>`
        : `${icon("book")} Find the ${["first", "next", "last"][done]} glowing storybook`;
  $("#sound-button").innerHTML = icon(progress.sound ? "sound" : "mute");
  $("#sound-button").setAttribute(
    "aria-label",
    progress.sound ? "Mute sounds" : "Enable sounds",
  );
  $("#map-books").innerHTML = w.tasks
    .map(
      (t) =>
        `<circle cx="${65 + t.position[0] * 1.6}" cy="${65 + t.position[1] * 1.6}" r="4" fill="${progress.completed.includes(t.id) ? "#5c9f79" : "#fff1b5"}" stroke="#987d48"/>`,
    )
    .join("");
  game?.refresh();
}
function setModal(content, kind = "generic", wide = false) {
  stopSpeech();
  recognition?.abort();
  recognition = null;
  if (!modalKind) previousFocus = document.activeElement;
  modalKind = kind;
  game?.setActive(false);
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""} ${kind === "welcome" ? "welcome-modal" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close round-button" data-action="close" aria-label="Close">${icon("close")}</button>${content}</section></div>`;
  $(".game-shell").inert = true;
  $(".rail").inert = true;
  requestAnimationFrame(() =>
    (
      $(".modal [autofocus]") ||
      $(".modal .primary") ||
      $(".modal button")
    )?.focus(),
  );
}
function closeModal() {
  stopSpeech();
  recognition?.abort();
  recognition = null;
  modalKind = "";
  $("#modal-root").innerHTML = "";
  $(".game-shell").inert = false;
  $(".rail").inert = false;
  if (!started) started = true;
  game?.setActive(true);
  previousFocus?.focus?.();
}
function modalHeader(eyebrow, title, subtitle = "", symbol = "sparkles") {
  return `<div class="modal-emblem">${icon(symbol)}</div><span class="tiny-label">${eyebrow}</span><h2 id="modal-title">${title}</h2>${subtitle ? `<p class="modal-intro">${subtitle}</p>` : ""}`;
}

function welcome() {
  setModal(
    `<div class="welcome-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="welcome-star s1">${icon("star")}</span><span class="welcome-star s2">${icon("sparkles")}</span><div class="welcome-friends"><div>${portrait("kit")}</div><div class="main-portrait">${portrait()}</div><div>${portrait("lily")}</div></div><span class="welcome-art-label">A LITTLE COURAGE. A LITTLE MAGIC.</span></div><div class="welcome-copy"><span class="tiny-label">AN ADVENTURE MADE FOR YOU</span><h2 id="modal-title">Small words.<br>Big <em>adventures.</em></h2><p>Welcome to the Magic Kingdom, Maisie. Explore with Lily, help your friends, and discover the magic of reading.</p><div class="welcome-features"><span>${icon("map")} 5 magical worlds</span><span>${icon("star")} 12 reading stars</span></div><button class="primary" data-action="start">${progress.completed.length ? "Continue my adventure" : "Let’s go exploring"} ${icon("arrow")}</button><button class="subtle-button full-width" data-action="simple-start">Play with simple graphics</button><p class="welcome-note">Take your time. Every try is a little bit of magic.</p></div>`,
    "welcome",
    true,
  );
}
function start() {
  closeModal();
  started = true;
  game?.setActive(true);
  narration(
    `Welcome, Maisie! Lily is by your side. Walk to Kit, or find a glowing storybook. Press E when you are close.`,
  );
  toast("Walk with W A S D or the arrow keys. You can also click the ground.");
}
function showMap() {
  setModal(
    `${modalHeader("YOUR JOURNEY", "A kingdom of little discoveries", "Follow the story, one reading star at a time.", "map")}<div class="world-grid">${WORLDS.map(
      (w, i) => {
        const open = worldOpen(progress, i),
          done = w.tasks.filter((t) =>
            progress.completed.includes(t.id),
          ).length;
        return `<button class="world-card ${open ? "" : "locked"} ${i === progress.world ? "current" : ""}" data-action="travel" data-index="${i}" ${open ? "" : "disabled"} style="--world-color:${w.color}"><span class="world-card-art">${icon(open ? w.icon : "lock")}<span class="chapter-bubble">0${i + 1}</span></span><small>CHAPTER ${i + 1} · ${w.focus.toUpperCase()}</small><strong>${w.name}</strong><span>${open ? (i === progress.world ? "You are here" : i === 4 ? "Your silver star is waiting" : `${done} of 3 stars found`) : `${w.requirement} reading stars to unlock`}</span><span class="world-card-footer">${open ? icon("arrow") : icon("lock")}${w.tasks.length ? `<span class="little-stars">${[0, 1, 2].map((n) => icon("star", n < done ? "filled" : "")).join("")}</span>` : icon("heart")}</span></button>`;
      },
    ).join(
      "",
    )}</div><div class="soft-note">${icon("heart")} Your words and stars travel with you. You can revisit any unlocked world.</div>`,
    "map",
    true,
  );
}
function travel(index) {
  if (!worldOpen(progress, index)) {
    toast("A few more reading stars will open this world.");
    return;
  }
  progress.world = index;
  save();
  game?.load(index);
  updateHUD();
  closeModal();
  chime(progress.sound, true);
  toast(`Welcome to ${WORLDS[index].name}!`);
  narration(WORLDS[index].greeting);
}
function guide() {
  const w = WORLDS[progress.world];
  setModal(
    `<div class="dialogue-portrait">${portrait(w.guide)}</div><span class="tiny-label">A HELLO FROM ${FRIENDS[w.guide].name.toUpperCase()}</span><h2 id="modal-title">${progress.world === 3 ? "Let’s find my mama." : "Hello, little explorer!"}</h2><p class="dialogue-text">${w.greeting}</p><button class="listen-button" data-action="guide-listen">${icon("sound")} Hear ${FRIENDS[w.guide].name}</button><button class="primary" data-action="close">${progress.world === 4 ? "Let’s find the silver star" : "Let’s explore together"} ${icon("arrow")}</button>`,
    "guide",
  );
  narration(w.greeting);
}
function interact(entity) {
  if (!entity) return;
  if (entity.type === "guide") guide();
  if (entity.type === "task") showTask(entity.task);
  if (entity.type === "final") ending(0);
}

function showTask(task) {
  currentTask = task;
  selected = [];
  rewardTask = null;
  const w = WORLDS.find((w) => w.tasks.some((t) => t.id === task.id));
  const isBuild = ["build", "order"].includes(task.type);
  const sentence =
    task.type === "sentence"
      ? `<div class="sentence-line">${task.prefix} <span class="blank-word">?</span>${task.suffix}</div>`
      : "";
  setModal(
    `<div class="lesson-top"><span class="friend-mini">${portrait(w.guide)}</span><span><small>READ WITH ${FRIENDS[w.guide].name.toUpperCase()}</small><strong>${task.title}</strong></span><span class="lesson-star">${icon("star")}</span></div><h2 id="modal-title">${task.prompt}</h2><button class="listen-button" data-action="listen-task">${icon("sound")} Listen again</button>${sentence}${isBuild ? `<div class="build-slots ${task.type === "order" ? "sentence-slots" : ""}" id="build-slots" aria-live="polite">${(task.letters || task.words).map(() => '<span class="letter-slot">·</span>').join("")}</div><div class="letter-choices">${(task.letters || task.words).map((l, i) => `<button class="letter-tile" data-action="letter" data-index="${i}">${l}</button>`).join("")}</div><button class="subtle-button" data-action="undo-letter">${icon("undo")} Try the letters again</button>` : `<div class="answer-choices">${task.choices.map((c, i) => `<button class="answer-card" data-action="answer" data-answer="${c}"><span class="choice-number">${i + 1}</span><strong>${c}</strong><span class="answer-circle"></span></button>`).join("")}</div>`}<div id="lesson-feedback" class="lesson-feedback" role="status">Take your time. You can always listen again.</div><div class="lesson-footer"><button class="subtle-button" data-action="hint">${icon("sparkles")} A little help</button><span>No timer. Just a little magic.</span></div>`,
    "lesson",
  );
  narration(task.spoken);
}
function checkAnswer(answer) {
  const task = currentTask;
  if (!task || modalKind !== "lesson") return;
  if (answer === task.answer) {
    const isNew = completeTask(progress, task.id);
    save();
    updateHUD();
    chime(progress.sound, true);
    reward(task, isNew);
  } else {
    $("#lesson-feedback").innerHTML = `${icon("heart")} Good try. ${task.hint}`;
    $("#lesson-feedback").classList.add("helpful");
    narration(`Good try. ${task.hint}`);
    if (["build", "order"].includes(task.type)) {
      setTimeout(() => {
        if (modalKind === "lesson" && currentTask === task) resetLetters();
      }, 650);
    } else
      document
        .querySelector(`[data-answer="${answer}"]`)
        ?.classList.add("tried");
  }
}
function resetLetters() {
  selected = [];
  updateLetters();
}
function updateLetters() {
  const options = currentTask.letters || currentTask.words;
  $("#build-slots").innerHTML = options
    .map(
      (_, i) =>
        `<span class="letter-slot ${selected[i] !== undefined ? "has-letter" : ""}">${selected[i] !== undefined ? options[selected[i]] : "·"}</span>`,
    )
    .join("");
  document
    .querySelectorAll(".letter-tile")
    .forEach((b) => (b.disabled = selected.includes(Number(b.dataset.index))));
}
function reward(task, isNew) {
  rewardTask = task;
  const next = WORLDS.find(
    (w) => w.requirement === progress.completed.length && w.requirement > 0,
  );
  setModal(
    `<div class="reward-star">${icon("star")}</div><span class="tiny-label">${isNew ? "A READING STAR FOR YOU" : "A LITTLE PRACTICE MAKES MAGIC"}</span><h2 id="modal-title">${isNew ? "You made a little magic!" : "Lovely reading, Maisie!"}</h2><div class="big-word">${task.chunks.map((c) => `<span>${c}</span>`).join("")}</div><p class="word-sentence">${task.sentence}</p><button class="listen-button" data-action="listen-word">${icon("sound")} Hear the word</button><div class="speaking-invite"><span class="speaking-icon">${icon("mic")}</span><div><strong>Now, give it a little voice.</strong><p>Try saying: “${task.speech}”</p></div></div><div id="speech-feedback" class="speech-feedback" role="status">Say it to Lily, a grown-up, or your favourite teddy.</div><div class="practice-actions"><button class="secondary" data-action="microphone">${icon("mic")} Use microphone</button><button class="secondary" data-action="practised">${icon("check")} I practised aloud</button></div><p class="microphone-note">Microphone is optional. Your browser may use an online speech service.</p>${next && isNew ? `<div class="unlock-note">${icon("sparkles")} ${next.name} is now open!</div>` : ""}<button class="primary" data-action="close">Keep exploring ${icon("arrow")}</button>`,
    "reward",
  );
  narration(
    `${isNew ? "Lovely reading! You earned a star." : "Lovely reading!"} ${task.word}. ${task.sentence}`,
  );
}
function practised() {
  if (!rewardTask) return;
  if (!progress.spoken.includes(rewardTask.id))
    progress.spoken.push(rewardTask.id);
  save();
  $("#speech-feedback").textContent =
    "Beautiful effort. Every time you try, your voice grows!";
  chime(progress.sound);
  document.querySelector('[data-action="practised"]').disabled = true;
}
function microphone() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("#speech-feedback").textContent =
      "This browser cannot listen. Say the words aloud, then tap “I practised aloud”.";
    return;
  }
  stopSpeech();
  recognition?.abort();
  recognition = new SpeechRecognition();
  recognition.lang = "en-GB";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  $("#speech-feedback").textContent =
    "Listening… say the little sentence when you are ready.";
  const taskId = rewardTask.id;
  recognition.onresult = (e) => {
    if (modalKind !== "reward" || rewardTask.id !== taskId) return;
    const text = e.results[0][0].transcript;
    $("#speech-feedback").textContent =
      `I heard “${text}”. Thank you for trying! Tap “I practised aloud” when you are ready.`;
  };
  recognition.onerror = () => {
    if (modalKind === "reward")
      $("#speech-feedback").textContent =
        "The microphone could not listen this time. Say it together and tap “I practised aloud”.";
  };
  recognition.onend = () => {
    if ($("#speech-feedback")?.textContent.startsWith("Listening"))
      $("#speech-feedback").textContent =
        "Try once more, or say it together and tap “I practised aloud”.";
  };
  try {
    recognition.start();
  } catch {
    $("#speech-feedback").textContent =
      "Say it together, then tap “I practised aloud”.";
  }
}
function journal() {
  const completed = ALL_TASKS.filter((t) => progress.completed.includes(t.id));
  const words = [...new Map(completed.map((t) => [t.word, t])).values()];
  setModal(
    `${modalHeader("MAISIE’S READING JOURNAL", "Look how much you’re growing.", "Every word is a little treasure. Tap a word to hear it again.", "book")}<div class="stats-row"><div><strong>${completed.length}</strong><span>reading stars</span></div><div><strong>${words.length}</strong><span>words explored</span></div><div><strong>${progress.spoken.length}</strong><span>speaking practices</span></div></div>${words.length ? `<div class="word-bank">${words.map((t) => `<button data-action="word" data-id="${t.id}"><span>${t.word}</span>${icon("sound")}</button>`).join("")}</div>` : `<div class="empty-state">${icon("book")}<h3>Your first word is waiting.</h3><p>Find a glowing storybook in Sunshine Meadow. Your words will appear here.</p></div>`}<div class="soft-note">${icon("heart")} Revisit any storybook to practise. Reading stars are yours to keep.</div><button class="primary" data-action="close">Back to my adventure ${icon("arrow")}</button>`,
    "journal",
    true,
  );
}
function friends() {
  setModal(
    `${modalHeader("BETTER TOGETHER", "Your magical little circle", "Kind friends, brave hearts, and a whole kingdom to explore.", "heart")}<div class="friends-grid">${Object.entries(
      FRIENDS,
    )
      .map(
        ([id, f]) =>
          `<div class="friend-card" style="--friend-color:${f.color}"><span>${portrait(id)}</span><h3>${f.name}</h3><p>${f.role}</p><small>${{ lily: "Your white cat companion, from the very first step.", kit: "A blue bunny with a very special silver star.", luna: "A gentle unicorn with a rainbow mane and a gold heart.", axel: "A pink axolotl with a blue bow tie and a love of splashing.", clover: "A little grey kitten who needs help finding Mama." }[id]}</small></div>`,
      )
      .join("")}</div>`,
    "friends",
    true,
  );
}
function settings() {
  setModal(
    `${modalHeader("THE GROWN-UP CORNER", "A little space for you.", "A gentle, self-paced reading adventure. Progress is saved in this browser.", "settings")}<div class="settings-list"><label><span><strong>Game sounds</strong><small>Gentle reward chimes and spoken words</small></span><input type="checkbox" data-setting="sound" ${progress.sound ? "checked" : ""}/></label><label><span><strong>Read instructions aloud</strong><small>You can always use the Listen buttons</small></span><input type="checkbox" data-setting="narration" ${progress.narration ? "checked" : ""}/></label><label><span><strong>Calmer movement</strong><small>Reduce floating and idle animations</small></span><input type="checkbox" data-setting="reducedMotion" ${progress.reducedMotion ? "checked" : ""}/></label></div><div class="parent-note"><strong>Learning at her own pace</strong><p>Activities move from initial /k/, /l/, and /s/ sounds to blending, rhyme, and sentences. Read together and model sounds aloud. Device voices may pronounce isolated letters as names; the games use whole-word examples. Speaking is optional and never graded.</p><p>Private co-op supports up to 6 players on the same server. Each child keeps their own reading progress. There is no public matchmaking or text chat.</p></div><button class="secondary full-width" data-action="graphics">Use simple graphics · keeps your progress</button><div class="parent-actions"><button class="secondary" data-action="party">${icon("users")} Family co-op</button><button class="subtle-button" data-action="reset-confirm">Start a fresh adventure</button></div>`,
    "settings",
  );
}
function help() {
  setModal(
    `${modalHeader("A LITTLE HELP", "Ready, set, explore.", "You and Lily have all the time in the world.", "help")}<div class="help-list"><div><kbd>W A S D</kbd><p><strong>Go exploring</strong>Use WASD or the arrow keys. You can also click the ground, or use the touch joystick.</p></div><div><kbd>SPACE</kbd><p><strong>A little leap</strong>Jump onto stepping stones. Hold Shift to run.</p></div><div><kbd>E</kbd><p><strong>Read or say hello</strong>Walk close to a book or a friend. Press E or tap the on-screen prompt.</p></div><div><kbd>M</kbd><p><strong>Find your next adventure</strong>Each set of 3 reading stars opens a new world. Gems are fun extras to collect.</p></div></div><div class="soft-note">${icon("sound")} Tap any Listen button to hear the words. If your device has no voice, a grown-up can read with you.</div><button class="primary" data-action="close">I’m ready ${icon("arrow")}</button>`,
    "help",
  );
}

function party() {
  setModal(
    `${modalHeader("A FAMILY ADVENTURE", "A little magic, together.", "Invite someone you know to explore beside you. Up to 6 friends can share a room.", "users")}<div id="party-content">${roomCode ? partyJoined() : `<label class="field-label" for="nickname">Your nickname</label><input id="nickname" class="text-input" maxlength="18" placeholder="Little explorer" autocomplete="off" value="Maisie"/><button class="primary" data-action="create-room">Create a private room ${icon("arrow")}</button><div class="or-divider">or join your family</div><label class="field-label" for="room-code">Six-character room code</label><div class="join-row"><input id="room-code" class="text-input code-input" maxlength="6" placeholder="ABC123" autocomplete="off"/><button class="secondary" data-action="join-room">Join room</button></div><p id="party-feedback" class="speech-feedback" role="status"></p>`}</div><p class="microphone-note">Share your code with family. Open this game on the same server in another browser or device. Each player collects their own stars.</p>`,
    "party",
  );
}
function partyJoined() {
  return `<div class="room-invite"><span class="tiny-label">YOUR PRIVATE ROOM CODE</span><strong>${roomCode}</strong><p>${roomPlayers.length} of 6 explorers connected</p><button class="secondary" data-action="copy-code">Copy invitation code</button></div><div class="connected-list">${roomPlayers.map((p) => `<span>${icon("leaf")} ${escapeHtml(p.name)}${p.id === ownId ? " (you)" : ""}</span>`).join("")}</div><button class="primary" data-action="close">Explore together ${icon("arrow")}</button><button class="subtle-button" data-action="leave-room">Leave room</button>`;
}
function connectParty(type) {
  if (location.protocol === "file:") {
    $("#party-feedback").textContent =
      "Family co-op is available in the hosted game. This downloaded copy is ready for solo adventures.";
    return;
  }
  const name = $("#nickname")?.value.trim() || "Maisie";
  const code = $("#room-code")?.value.trim();
  if (type === "join" && !/^[a-z0-9]{6}$/i.test(code || "")) {
    $("#party-feedback").textContent =
      "Enter the six-character code from your family.";
    return;
  }
  const payload = { type, name, code };
  $("#party-feedback").textContent = "Opening a little door to the kingdom…";
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return;
  }
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/party`,
  );
  const activeSocket = socket;
  socket.onopen = () => activeSocket.send(JSON.stringify(payload));
  socket.onmessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m.type === "error") {
      if ($("#party-feedback")) $("#party-feedback").textContent = m.message;
      else toast(m.message);
    }
    if (m.type === "joined") {
      roomCode = m.code;
      ownId = m.id;
      toast("Your private family room is open.");
    }
    if (m.type === "players") {
      const rosterChanged =
        JSON.stringify(roomPlayers.map((p) => [p.id, p.name])) !==
        JSON.stringify(m.players.map((p) => [p.id, p.name]));
      roomPlayers = m.players;
      game?.updatePeers(roomPlayers.filter((p) => p.id !== ownId));
      $("#party-status").textContent = `Together · ${roomPlayers.length}/6`;
      if (modalKind === "party" && roomCode && rosterChanged)
        $("#party-content").innerHTML = partyJoined();
    }
    if (m.type === "left") clearParty();
  };
  socket.onerror = () => {
    if ($("#party-feedback"))
      $("#party-feedback").textContent =
        "The room server could not connect. You can keep playing on your own.";
  };
  socket.onclose = () => {
    if (socket !== activeSocket) return;
    const wasJoined = Boolean(roomCode);
    clearParty();
    if (wasJoined)
      toast("The family connection closed. Your reading progress is safe.");
  };
}
function clearParty() {
  roomCode = "";
  ownId = "";
  roomPlayers = [];
  game?.updatePeers([]);
  $("#party-status").textContent = "Play together";
  if (modalKind === "party") party();
}
function ending(page) {
  if (progress.completed.length < 12) {
    toast("Help your friends collect all 12 reading stars first.");
    return;
  }
  const scenes = [
    {
      who: "kit",
      eyebrow: "A GIFT FROM KIT",
      title: "A little silver star.",
      text: "“For your kind heart and brave reading,” says Kit. He gives Maisie a little silver star. Luna smiles, and Lily stays close.",
      button: "Give everyone a hug",
    },
    {
      who: "luna",
      eyebrow: "FRIENDS ARE NEVER FAR AWAY",
      title: "One more hug.",
      text: "Maisie hugs Luna, Kit, and Axel goodbye. Clover is safe at home with Mama. Lily curls beside Maisie as silver light begins to sparkle.",
      button: "Follow the silver light",
    },
    {
      who: "lily",
      eyebrow: "HOME, WITH A HEART FULL OF MAGIC",
      title: "Goodnight, Magic Kingdom.",
      text: "Maisie and Lily return to her room in a shimmer of silver light. Lily settles on her lap. The silver star shines on the shelf. Maisie looks up at the stars and says, “Goodnight.”",
      button: "Keep the magic going",
    },
  ];
  const scene = scenes[page];
  if (page === 2) {
    progress.ending = true;
    save();
    updateHUD();
    chime(progress.sound, true);
  }
  setModal(
    `<div class="ending-art"><div class="silver-star">${icon("star")}</div><span>${portrait(scene.who)}</span></div><span class="tiny-label">${scene.eyebrow}</span><h2 id="modal-title">${scene.title}</h2><p class="dialogue-text">${scene.text}</p><div class="ending-dots">${[0, 1, 2].map((i) => `<span class="${i === page ? "on" : ""}"></span>`).join("")}</div><button class="primary" data-action="${page === 2 ? "map" : "ending"}" data-index="${page + 1}">${scene.button} ${icon("arrow")}</button>`,
    "ending",
  );
  narration(scene.text);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  const actions = {
    welcome,
    start,
    "simple-start": () => {
      progress.graphics = "simple";
      save();
      useSimpleGraphics();
      start();
    },
    graphics: () => {
      progress.graphics = "simple";
      save();
      useSimpleGraphics();
      closeModal();
      toast("Simple graphics are on. Your adventure and stars are still here.");
    },
    close: closeModal,
    explore: () => (modalKind ? closeModal() : null),
    map: showMap,
    journal,
    friends,
    settings,
    help,
    party,
    travel: () => travel(Number(b.dataset.index)),
    interact: () => game?.interact(),
    sound: () => {
      progress.sound = !progress.sound;
      if (!progress.sound) stopSpeech();
      save();
      updateHUD();
    },
    "narrate-quest": () => narration(WORLDS[progress.world].story, true),
    "guide-listen": () => narration(WORLDS[progress.world].greeting, true),
    "listen-task": () => narration(currentTask.spoken, true),
    answer: () => checkAnswer(b.dataset.answer),
    letter: () => {
      const i = Number(b.dataset.index);
      if (selected.includes(i)) return;
      selected.push(i);
      updateLetters();
      const options = currentTask.letters || currentTask.words;
      if (selected.length === options.length)
        checkAnswer(
          selected
            .map((n) => options[n])
            .join(currentTask.type === "order" ? " " : ""),
        );
    },
    "undo-letter": resetLetters,
    hint: () => {
      $("#lesson-feedback").textContent = currentTask.hint;
      narration(currentTask.hint, true);
    },
    "listen-word": () =>
      narration(`${rewardTask.word}. ${rewardTask.sentence}`, true),
    practised,
    microphone,
    word: () => {
      const t = ALL_TASKS.find((t) => t.id === b.dataset.id);
      if (t) narration(`${t.word}. ${t.sentence}`, true);
    },
    "create-room": () => connectParty("create"),
    "join-room": () => connectParty("join"),
    "leave-room": () => {
      socket?.send(JSON.stringify({ type: "leave" }));
      socket?.close();
      clearParty();
    },
    "copy-code": async () => {
      try {
        await navigator.clipboard.writeText(roomCode);
        toast("Room code copied. Share it with your family.");
      } catch {
        toast(`Your room code is ${roomCode}.`);
      }
    },
    "reset-confirm": () =>
      setModal(
        `${modalHeader("A FRESH PAGE", "Begin a new adventure?", "This removes the reading stars, gems, and word journal saved in this browser.", "undo")}<button class="primary" data-action="reset">Yes, start again</button><button class="secondary full-width" data-action="settings">Keep my adventure</button>`,
        "reset",
      ),
    reset: () => {
      Object.assign(progress, freshProgress());
      save();
      game?.load(0);
      updateHUD();
      welcome();
    },
    ending: () => ending(Number(b.dataset.index)),
  };
  actions[a]?.();
});
document.addEventListener("change", (e) => {
  const k = e.target.dataset.setting;
  if (k) {
    progress[k] = e.target.checked;
    save();
    updateHUD();
    if (!progress.sound || !progress.narration) stopSpeech();
  }
});
document.addEventListener("keydown", (e) => {
  if (modalKind && e.code === "Escape") {
    closeModal();
    return;
  }
  if (modalKind && e.key === "Tab") {
    const nodes = [
      ...document.querySelectorAll(
        ".modal button:not([disabled]), .modal input:not([disabled]), .modal a[href]",
      ),
    ];
    const first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  if (!modalKind && e.code === "KeyM" && !e.repeat) showMap();
});

const worldCallbacks = {
  interact,
  near: (entity) => {
    const el = $("#near-prompt");
    el.classList.toggle("hidden", !entity);
    if (entity)
      $("#near-text").textContent =
        entity.type === "guide"
          ? `Say hello to ${FRIENDS[WORLDS[progress.world].guide].name}`
          : entity.type === "final"
            ? "Receive Kit’s silver star"
            : progress.completed.includes(entity.id)
              ? "Read this book again"
              : "Open the storybook";
  },
  collect: (id) => {
    if (!progress.seeds.includes(id)) {
      progress.seeds.push(id);
      save();
      updateHUD();
      chime(progress.sound);
    }
  },
  position: (p, t) => {
    $("#map-player").setAttribute(
      "transform",
      `translate(${65 + p.x * 1.6} ${65 + p.z * 1.6}) rotate(${180 - (p.rotation * 180) / Math.PI})`,
    );
    if (
      roomCode &&
      socket?.readyState === WebSocket.OPEN &&
      t - lastSent > 0.1
    ) {
      lastSent = t;
      socket.send(JSON.stringify({ type: "move", position: p }));
    }
  },
  graphicsLost: () => useSimpleGraphics(),
};
function useSimpleGraphics() {
  const position = game?.player?.position;
  const savedPosition = position && { x: position.x, z: position.z };
  game?.destroy();
  game = new World2D($("#scene"), worldCallbacks, progress);
  lastSent = 0;
  if (savedPosition) game.teleport(savedPosition.x, savedPosition.z);
  game.updatePeers(roomPlayers.filter((p) => p.id !== ownId));
  game.setActive(started && !modalKind);
  $(".game-shell").dataset.graphics = "simple";
  if (window.__game) window.__game.game = game;
}
try {
  if (
    progress.graphics === "simple" ||
    new URLSearchParams(location.search).get("graphics") === "simple"
  ) {
    useSimpleGraphics();
  } else {
    game = new World($("#scene"), worldCallbacks, progress);
    $(".game-shell").dataset.graphics = "3d";
  }
} catch (error) {
  console.warn("Using simple graphics:", error.message);
  useSimpleGraphics();
}
const joy = $("#joystick"),
  knob = $("#joystick-knob");
let joystickPointer = null;
function moveJoystick(e) {
  if (joystickPointer !== e.pointerId) return;
  const r = joy.getBoundingClientRect();
  let x = (e.clientX - r.left - r.width / 2) / 35,
    y = (e.clientY - r.top - r.height / 2) / 35;
  const length = Math.max(1, Math.hypot(x, y));
  x /= length;
  y /= length;
  knob.style.transform = `translate(${x * 30}px,${y * 30}px)`;
  if (game) game.joystick = { x, y };
}
joy.addEventListener("pointerdown", (e) => {
  joystickPointer = e.pointerId;
  joy.setPointerCapture(e.pointerId);
  moveJoystick(e);
});
joy.addEventListener("pointermove", moveJoystick);
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  joy.addEventListener(event, () => {
    joystickPointer = null;
    knob.style.transform = "";
    if (game) game.joystick = { x: 0, y: 0 };
  });
$("#touch-jump").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (game?.active) game.jump();
});
updateHUD();
welcome();
window.dispatchEvent(new Event("maisie-ready"));
if (import.meta.env.DEV && new URLSearchParams(location.search).has("test"))
  window.__game = { game, progress, showTask, travel, ending };
