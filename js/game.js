// ============================================================
//  LOCAL STORAGE
// ============================================================
function loadPlayers() {
  try { return JSON.parse(localStorage.getItem('rg_players')) || []; } catch { return []; }
}
function savePlayers(players) {
  localStorage.setItem('rg_players', JSON.stringify(players));
}
function loadCustomPrompts() {
  try { return JSON.parse(localStorage.getItem('rg_custom_prompts')) || []; } catch { return []; }
}
function saveCustomPrompts(prompts) {
  localStorage.setItem('rg_custom_prompts', JSON.stringify(prompts));
}

// ============================================================
//  GAME STATE
// ============================================================
let state = {
  players: loadPlayers(),
  customPrompts: [],            // [ { text, creator } ]
  activeCategories: ['standard'],
  totalRounds: 2,               // 1 round = everyone ranks once
  timerSeconds: 120,
  currentRound: 0,
  currentTurnInRound: 0,
  rankerIndex: 0,
  currentPrompt: '',
  currentPromptCreator: null,
  currentRanking: [],
  decoyPrompts: [],
  guesses: {},
  scores: {},
  roundScores: {},
  usedPrompts: [],
  promptPool: [],
  submitPlayerIndex: 0,
  playerSubmittedThisRound: [],
  streaks: {},
  guessTimestamps: {},
  usedCustomPrompts: [],
  promptVotes: {},
};

// ============================================================
//  CONFETTI
// ============================================================
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const colors = ['#7c3aed', '#e11d75', '#f59e0b', '#16a34a', '#3b82f6', '#ec4899'];
  const particles = [];
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * canvas.height * 0.5,
      w: 4 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.vy += 0.05;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      if (frame > 60) p.opacity -= 0.01;
      if (p.opacity <= 0) return;
      alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (alive) requestAnimationFrame(animate);
    else canvas.style.display = 'none';
  }
  requestAnimationFrame(animate);
}

// ============================================================
//  HAPTIC FEEDBACK
// ============================================================
function haptic(pattern) {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (_) {}
}

// ============================================================
//  DOM REFERENCES
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
//  SCREEN NAVIGATION
// ============================================================
function showScreen(id) {
  stopTimer();
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#screen-${id}`).classList.add('active');
}

// ============================================================
//  TIMER
// ============================================================
let timerInterval = null;
let timerRemaining = 0;
let timerCallback = null;

function startTimer(seconds, fillEl, textEl, barEl, onExpire) {
  stopTimer();
  if (!seconds || seconds <= 0) {
    barEl.style.display = 'none';
    return;
  }
  barEl.style.display = 'flex';
  timerRemaining = seconds;
  timerCallback = onExpire;
  fillEl.style.width = '100%';
  fillEl.classList.remove('urgent');
  barEl.classList.remove('urgent');
  textEl.textContent = seconds;

  timerInterval = setInterval(() => {
    timerRemaining--;
    textEl.textContent = timerRemaining;
    fillEl.style.width = (timerRemaining / seconds * 100) + '%';
    if (timerRemaining <= 10) {
      fillEl.classList.add('urgent');
      barEl.classList.add('urgent');
      SFX.tick();
    }
    if (timerRemaining <= 0) {
      stopTimer();
      SFX.timeUp();
      if (timerCallback) timerCallback();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerCallback = null;
}

// ============================================================
//  HOME SCREEN LOGIC
// ============================================================
const playerInput = $('#player-name-input');
const addPlayerBtn = $('#add-player-btn');
const playerListEl = $('#player-list');
const playerCountEl = $('#player-count');
const startBtn = $('#start-game-btn');

function renderPlayers() {
  playerListEl.innerHTML = state.players.map((name, i) =>
    `<div class="player-chip">
      ${name}
      <span class="remove" data-index="${i}">&times;</span>
    </div>`
  ).join('');

  const count = state.players.length;
  if (count < 3) {
    playerCountEl.textContent = `Add at least ${3 - count} more player${3 - count > 1 ? 's' : ''}`;
    startBtn.disabled = true;
  } else {
    playerCountEl.textContent = `${count} players ready`;
    startBtn.disabled = false;
  }
  savePlayers(state.players);
}

function addPlayer() {
  const name = playerInput.value.trim();
  if (!name) return;
  if (state.players.includes(name)) {
    playerInput.value = '';
    return;
  }
  state.players.push(name);
  playerInput.value = '';
  playerInput.focus();
  SFX.tap(); haptic(15);
  renderPlayers();
}

addPlayerBtn.addEventListener('click', addPlayer);
playerInput.addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });
playerListEl.addEventListener('click', e => {
  if (e.target.classList.contains('remove')) {
    state.players.splice(+e.target.dataset.index, 1);
    renderPlayers();
  }
});

// ---- Category toggles ----
function initCategoryToggles() {
  const container = $('#category-toggles');
  container.innerHTML = Object.entries(PACK_INFO).map(([key, info]) => {
    const isActive = key === 'standard' ? ' active' : '';
    const nsfwClass = key === 'nsfw' ? ' nsfw' : '';
    return `<div class="pack-card${nsfwClass}${isActive}" data-cat="${key}">
      <div class="pack-header">${info.emoji} ${info.label}</div>
      <div class="pack-desc">${info.description}</div>
    </div>`;
  }).join('');

  container.querySelectorAll('.pack-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('active');
      SFX.tap(); haptic(15);
      updateActiveCategories();
    });
  });
}

function updateActiveCategories() {
  state.activeCategories = Array.from($$('.pack-card.active')).map(b => b.dataset.cat);
  const showCustom = state.activeCategories.includes('custom');
  $('#custom-prompts-section').style.display = showCustom ? 'block' : 'none';
  updatePoolInfo();
}

function updatePoolInfo() {
  let count = 0;
  state.activeCategories.forEach(cat => {
    if (cat === 'custom') count += state.customPrompts.length;
    else if (PROMPT_PACKS[cat]) count += PROMPT_PACKS[cat].length;
  });
  $('#prompt-pool-info').textContent = count > 0 ? `${count} prompts in the pool` : 'Select at least one pack';

  const toggleBtn = $('#toggle-pool-preview');
  const preview = $('#pool-preview');
  if (count > 0) {
    toggleBtn.style.display = 'inline-block';
  } else {
    toggleBtn.style.display = 'none';
    preview.style.display = 'none';
    toggleBtn.textContent = 'Show all prompts';
  }
  if (preview.style.display !== 'none') renderPoolPreview();
}

function renderPoolPreview() {
  const preview = $('#pool-preview');
  let html = '';
  state.activeCategories.forEach(cat => {
    if (cat === 'custom') {
      if (state.customPrompts.length > 0) {
        html += `<div class="pool-cat-label">${PACK_INFO.custom.emoji} Custom</div>`;
        state.customPrompts.forEach(p => {
          html += `<div class="pool-prompt">${p.text}</div>`;
        });
      }
    } else if (PROMPT_PACKS[cat]) {
      const info = PACK_INFO[cat];
      html += `<div class="pool-cat-label">${info.emoji} ${info.label}</div>`;
      PROMPT_PACKS[cat].forEach(text => {
        html += `<div class="pool-prompt">${text}</div>`;
      });
    }
  });
  preview.innerHTML = html;
}

// ---- Pool preview toggle ----
$('#toggle-pool-preview').addEventListener('click', () => {
  const preview = $('#pool-preview');
  const btn = $('#toggle-pool-preview');
  if (preview.style.display === 'none') {
    renderPoolPreview();
    preview.style.display = 'block';
    btn.textContent = 'Hide prompts';
  } else {
    preview.style.display = 'none';
    btn.textContent = 'Show all prompts';
  }
});

// ---- Custom prompts on home screen ----
const customPromptInput = $('#custom-prompt-input');
const addPromptBtn = $('#add-prompt-btn');

function renderCustomPrompts() {
  const list = $('#custom-prompt-list');
  list.innerHTML = state.customPrompts.map((p, i) =>
    `<div class="prompt-item">
      <span>${p.text}${p.creator ? ' <span class="creator-bonus">by ' + p.creator + '</span>' : ''}</span>
      <span class="remove" data-index="${i}">&times;</span>
    </div>`
  ).join('');
  const countEl = $('#custom-prompt-count');
  countEl.textContent = state.customPrompts.length > 0
    ? `${state.customPrompts.length} custom prompt${state.customPrompts.length > 1 ? 's' : ''}`
    : '';
  updatePoolInfo();
}

function addCustomPrompt() {
  const text = customPromptInput.value.trim();
  if (!text) return;
  if (state.customPrompts.some(p => p.text === text)) {
    customPromptInput.value = '';
    return;
  }
  state.customPrompts.push({ text, creator: null });
  customPromptInput.value = '';
  customPromptInput.focus();
  SFX.tap(); haptic(15);
  renderCustomPrompts();
}

addPromptBtn.addEventListener('click', addCustomPrompt);
customPromptInput.addEventListener('keydown', e => { if (e.key === 'Enter') addCustomPrompt(); });
$('#custom-prompt-list').addEventListener('click', e => {
  if (e.target.classList.contains('remove')) {
    state.customPrompts.splice(+e.target.dataset.index, 1);
    renderCustomPrompts();
  }
});

// ---- Save/Load custom prompts ----
$('#save-prompts-btn').addEventListener('click', () => {
  if (state.customPrompts.length === 0) return;
  saveCustomPrompts(state.customPrompts);
  alert('Custom prompts saved!');
});
$('#load-prompts-btn').addEventListener('click', () => {
  const loaded = loadCustomPrompts();
  if (loaded.length === 0) {
    alert('No saved prompts found.');
    return;
  }
  loaded.forEach(p => {
    if (!state.customPrompts.some(e => e.text === p.text)) {
      state.customPrompts.push(p);
    }
  });
  renderCustomPrompts();
});

// ---- Rounds selector ----
$('#rounds-minus').addEventListener('click', () => {
  if (state.totalRounds > 1) {
    state.totalRounds--;
    $('#rounds-num').textContent = state.totalRounds;
    SFX.tap(); haptic(15);
  }
});
$('#rounds-plus').addEventListener('click', () => {
  if (state.totalRounds < 10) {
    state.totalRounds++;
    $('#rounds-num').textContent = state.totalRounds;
    SFX.tap(); haptic(15);
  }
});

// ---- Timer selector ----
$('#timer-minus').addEventListener('click', () => {
  if (state.timerSeconds > 0) {
    state.timerSeconds = Math.max(0, state.timerSeconds - 15);
    $('#timer-num').textContent = state.timerSeconds || 'Off';
    SFX.tap(); haptic(15);
  }
});
$('#timer-plus').addEventListener('click', () => {
  if (state.timerSeconds < 180) {
    state.timerSeconds += 15;
    $('#timer-num').textContent = state.timerSeconds;
    SFX.tap(); haptic(15);
  }
});

// ============================================================
//  START GAME
// ============================================================
startBtn.addEventListener('click', () => {
  const hasCustomCat = state.activeCategories.includes('custom');
  const hasSubmissionPlayers = hasCustomCat && state.customPrompts.length === 0;

  if (hasSubmissionPlayers) {
    state.submitPlayerIndex = 0;
    showSubmitScreen();
  } else {
    buildPoolAndStart();
  }
});

function buildPoolAndStart() {
  let pool = [];
  state.activeCategories.forEach(cat => {
    if (cat === 'custom') {
      pool.push(...state.customPrompts);
    } else if (PROMPT_PACKS[cat]) {
      pool.push(...PROMPT_PACKS[cat].map(text => ({ text, creator: null })));
    }
  });

  if (pool.length < 5) {
    alert(`Need at least 5 prompts to play (the ranker picks from 5 options). Got ${pool.length}.`);
    return;
  }

  state.promptPool = pool;
  state.usedPrompts = [];
  state.currentRound = 1;
  state.currentTurnInRound = 0;
  state.rankerIndex = 0;
  state.scores = {};
  state.streaks = {};
  state.usedCustomPrompts = [];
  state.promptVotes = {};
  state.players.forEach(p => { state.scores[p] = 0; state.streaks[p] = 0; });

  SFX.roundStart(); haptic(30);
  startTurn();
}

// ============================================================
//  SUBMIT PROMPTS PHASE
// ============================================================
function showSubmitScreen() {
  const player = state.players[state.submitPlayerIndex];
  $('#submit-player-name').textContent = player;
  state.playerSubmittedThisRound = [];
  const input = $('#submit-prompt-input');
  input.value = '';
  cycleSubmitPlaceholder();
  renderSubmittedPrompts();
  updateSubmitButton();
  showScreen('submit');
  input.focus();
}

function cycleSubmitPlaceholder() {
  const starter = PLACEHOLDER_STARTERS[Math.floor(Math.random() * PLACEHOLDER_STARTERS.length)];
  $('#submit-prompt-input').placeholder = starter;
  $('#submit-inspiration').textContent = `Try: "${starter}" or get creative!`;
}

function renderSubmittedPrompts() {
  const el = $('#submitted-prompts');
  el.innerHTML = state.playerSubmittedThisRound.map((text, i) =>
    `<div class="prompt-item">
      <span>${text}</span>
      <span class="remove" data-index="${i}">&times;</span>
    </div>`
  ).join('');
}

function updateSubmitButton() {
  const btn = $('#submit-done-btn');
  const count = state.playerSubmittedThisRound.length;
  const isLast = state.submitPlayerIndex >= state.players.length - 1;
  btn.disabled = count === 0;
  btn.textContent = isLast
    ? (count > 0 ? 'Done - Start Game!' : 'Add at least 1 prompt')
    : (count > 0 ? 'Done - Pass to Next Player' : 'Add at least 1 prompt');
  $('#submit-prompt-hint').textContent = count > 0
    ? `${count} prompt${count > 1 ? 's' : ''} added`
    : 'Add at least 1 prompt, then pass the phone';
}

$('#submit-prompt-btn').addEventListener('click', addSubmitPrompt);
$('#submit-prompt-input').addEventListener('keydown', e => { if (e.key === 'Enter') addSubmitPrompt(); });

function addSubmitPrompt() {
  const input = $('#submit-prompt-input');
  const text = input.value.trim();
  if (!text) return;
  const player = state.players[state.submitPlayerIndex];
  if (state.customPrompts.some(p => p.text === text) || state.playerSubmittedThisRound.includes(text)) {
    input.value = '';
    return;
  }
  state.customPrompts.push({ text, creator: player });
  state.playerSubmittedThisRound.push(text);
  input.value = '';
  cycleSubmitPlaceholder();
  input.focus();
  SFX.tap(); haptic(15);
  renderSubmittedPrompts();
  updateSubmitButton();
}

$('#submitted-prompts').addEventListener('click', e => {
  if (e.target.classList.contains('remove')) {
    const idx = +e.target.dataset.index;
    const text = state.playerSubmittedThisRound[idx];
    state.playerSubmittedThisRound.splice(idx, 1);
    state.customPrompts = state.customPrompts.filter(p => p.text !== text);
    renderSubmittedPrompts();
    updateSubmitButton();
  }
});

$('#submit-done-btn').addEventListener('click', () => {
  state.submitPlayerIndex++;
  if (state.submitPlayerIndex < state.players.length) {
    showSubmitScreen();
  } else {
    buildPoolAndStart();
  }
});

// ============================================================
//  ROUND FLOW
// ============================================================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick5Prompts() {
  let available = state.promptPool.filter(p => !state.usedPrompts.includes(p.text));
  if (available.length < 5) {
    state.usedPrompts = [];
    available = [...state.promptPool];
  }
  return shuffle(available).slice(0, 5);
}

function getRoundLabel() {
  return `Round ${state.currentRound}/${state.totalRounds} - Turn ${state.currentTurnInRound}/${state.players.length}`;
}

function totalTurnsPlayed() {
  return (state.currentRound - 1) * state.players.length + state.currentTurnInRound;
}

function totalTurns() {
  return state.totalRounds * state.players.length;
}

function startTurn() {
  state.currentTurnInRound++;
  const ranker = state.players[state.rankerIndex];

  $('#pass-player-name').textContent = ranker;
  $('#pass-round-info').textContent = getRoundLabel();
  showScreen('pass');
}

$('#ready-btn').addEventListener('click', () => {
  SFX.select(); haptic(30);
  showPickPrompt();
});

// ============================================================
//  PICK PROMPT (ranker chooses from 5)
// ============================================================
let pickedPromptObj = null;

function showPickPrompt() {
  const options = pick5Prompts();
  const ranker = state.players[state.rankerIndex];
  pickedPromptObj = null;

  $('#pick-round-label').textContent = getRoundLabel();
  $('#pick-ranker-name').textContent = ranker;

  const optionsEl = $('#prompt-pick-options');
  optionsEl.innerHTML = options.map((p, i) =>
    `<button class="prompt-pick-option" data-index="${i}">
      ${p.text}
    </button>`
  ).join('');

  optionsEl.onclick = (e) => {
    const btn = e.target.closest('.prompt-pick-option');
    if (!btn) return;
    const idx = +btn.dataset.index;
    pickedPromptObj = options[idx];
    $$('.prompt-pick-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    $('#pick-prompt-btn').disabled = false;
    SFX.tap(); haptic(15);
  };

  $('#pick-prompt-btn').disabled = true;
  showScreen('pick');
}

$('#pick-prompt-btn').addEventListener('click', () => {
  if (!pickedPromptObj) return;

  state.currentPrompt = pickedPromptObj.text;
  state.currentPromptCreator = pickedPromptObj.creator;
  state.usedPrompts.push(pickedPromptObj.text);

  if (pickedPromptObj.creator && !state.usedCustomPrompts.some(p => p.text === pickedPromptObj.text)) {
    state.usedCustomPrompts.push({ text: pickedPromptObj.text, creator: pickedPromptObj.creator });
  }

  const decoyPool = state.promptPool.filter(p => p.text !== state.currentPrompt);
  state.decoyPrompts = shuffle(decoyPool).slice(0, 3).map(p => p.text);

  SFX.select(); haptic(30);
  showSecretRanking();
});

function showSecretRanking() {
  const ranker = state.players[state.rankerIndex];
  const others = state.players.filter(p => p !== ranker);

  $('#secret-round-label').textContent = getRoundLabel();
  $('#secret-ranker-name').textContent = ranker;
  $('#secret-prompt-text').textContent = state.currentPrompt;

  state.currentRanking = shuffle(others);
  renderRankList();
  showScreen('secret');

  startTimer(
    state.timerSeconds,
    $('#secret-timer-fill'),
    $('#secret-timer-text'),
    $('#secret-timer'),
    () => { $('#confirm-ranking-btn').click(); }
  );
}

// ============================================================
//  DRAG & DROP RANKING (pointer-based, smooth reorder)
// ============================================================
let sortState = null;

function renderRankList() {
  const list = $('#rank-list');
  list.innerHTML = state.currentRanking.map((name, i) =>
    `<li class="rank-item" data-index="${i}">
      <span class="rank-number">${i + 1}</span>
      <span class="rank-name">${name}</span>
      <span class="drag-handle">&#9776;</span>
    </li>`
  ).join('');
  attachSortListeners();
}

function attachSortListeners() {
  const items = $$('#rank-list .rank-item');
  items.forEach(item => {
    item.addEventListener('pointerdown', onSortStart);
  });
}

function onSortStart(e) {
  if (e.button && e.button !== 0) return;
  const item = e.currentTarget;
  const list = item.parentElement;
  const items = Array.from(list.children);
  const idx = items.indexOf(item);
  const rect = item.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();

  // Measure all item heights and positions before drag
  const rects = items.map(el => el.getBoundingClientRect());
  const itemHeight = rect.height + 8; // height + margin-bottom

  item.classList.add('dragging');
  item.setPointerCapture(e.pointerId);

  sortState = {
    item,
    list,
    items,
    idx,
    currentIdx: idx,
    startY: e.clientY,
    offsetY: 0,
    itemHeight,
    rects,
  };

  // Disable transitions on dragged item during move
  item.style.transition = 'box-shadow 0.2s ease';

  const onMove = (ev) => {
    if (!sortState) return;
    ev.preventDefault();
    const dy = ev.clientY - sortState.startY;
    sortState.offsetY = dy;

    // Move dragged item
    sortState.item.style.transform = `translateY(${dy}px) scale(1.03)`;

    // Figure out where the item would land
    const draggedCenter = sortState.rects[sortState.idx].top + sortState.rects[sortState.idx].height / 2 + dy;
    let newIdx = sortState.idx;

    for (let i = 0; i < sortState.rects.length; i++) {
      const mid = sortState.rects[i].top + sortState.rects[i].height / 2;
      if (draggedCenter < mid) {
        newIdx = i;
        break;
      }
      newIdx = i + 1;
    }
    newIdx = Math.max(0, Math.min(newIdx, sortState.items.length - 1));
    if (newIdx > sortState.idx) newIdx = Math.min(newIdx, sortState.items.length - 1);

    if (newIdx !== sortState.currentIdx) {
      sortState.currentIdx = newIdx;
      SFX.tap(); haptic(10);
    }

    // Shift other items to make room
    sortState.items.forEach((el, i) => {
      if (i === sortState.idx) return;
      let shift = 0;
      if (sortState.idx < newIdx && i > sortState.idx && i <= newIdx) {
        shift = -sortState.itemHeight;
      } else if (sortState.idx > newIdx && i < sortState.idx && i >= newIdx) {
        shift = sortState.itemHeight;
      }
      el.style.transition = 'transform 0.2s ease';
      el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };

  const onEnd = () => {
    if (!sortState) return;
    const { idx: fromIdx, currentIdx: toIdx } = sortState;

    // Reset all transforms
    sortState.items.forEach(el => {
      el.style.transition = '';
      el.style.transform = '';
    });
    sortState.item.classList.remove('dragging');
    sortState.item.style.transition = '';

    // Apply reorder if changed
    if (fromIdx !== toIdx) {
      const [moved] = state.currentRanking.splice(fromIdx, 1);
      state.currentRanking.splice(toIdx, 0, moved);
      haptic(15);
    }

    sortState.item.removeEventListener('pointermove', onMove);
    sortState.item.removeEventListener('pointerup', onEnd);
    sortState.item.removeEventListener('pointercancel', onEnd);
    sortState = null;

    renderRankList();
  };

  item.addEventListener('pointermove', onMove);
  item.addEventListener('pointerup', onEnd);
  item.addEventListener('pointercancel', onEnd);
}

// ============================================================
//  CONFIRM RANKING → GUESSING PHASE
// ============================================================
$('#confirm-ranking-btn').addEventListener('click', () => {
  stopTimer();
  state.guesses = {};
  state.guessTimestamps = {};
  state.roundScores = {};
  state.players.forEach(p => state.roundScores[p] = 0);
  SFX.select(); haptic(30);
  showGuessScreen();
});

function showGuessScreen() {
  const ranker = state.players[state.rankerIndex];
  const guessers = state.players.filter(p => p !== ranker);

  $('#guess-round-label').textContent = getRoundLabel();

  const revealEl = $('#ranking-reveal');
  revealEl.innerHTML = state.currentRanking.map((name, i) =>
    `<div class="rank-item">
      <span class="rank-number">${i + 1}</span>
      <span class="rank-name">${name}</span>
    </div>`
  ).join('');

  const tabsEl = $('#guesser-tabs');
  tabsEl.innerHTML = guessers.map((name, i) =>
    `<button class="guesser-tab ${i === 0 ? 'active' : ''}" data-guesser="${name}">${name}</button>`
  ).join('');

  const options = shuffle([state.currentPrompt, ...state.decoyPrompts]);
  const optionsEl = $('#guess-options');
  optionsEl.innerHTML = options.map(opt =>
    `<button class="guess-option" data-prompt="${opt}">${opt}</button>`
  ).join('');

  let currentGuesser = guessers[0];
  updateGuessUI(currentGuesser);

  tabsEl.onclick = (e) => {
    if (e.target.classList.contains('guesser-tab')) {
      currentGuesser = e.target.dataset.guesser;
      $$('.guesser-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      updateGuessUI(currentGuesser);
    }
  };

  let guessLocked = false;
  optionsEl.onclick = (e) => {
    const btn = e.target.closest('.guess-option');
    if (!btn || guessLocked) return;
    state.guesses[currentGuesser] = btn.dataset.prompt;
    state.guessTimestamps[currentGuesser] = timerRemaining;

    const tab = tabsEl.querySelector(`[data-guesser="${currentGuesser}"]`);
    if (tab) tab.classList.add('guessed');
    updateGuessUI(currentGuesser);

    guessLocked = true;
    btn.classList.add('locked');
    optionsEl.classList.add('locked');
    SFX.swoosh(); haptic(30);

    const nextUn = guessers.find(g => !state.guesses[g] && g !== currentGuesser);
    const allGuessed = guessers.every(g => state.guesses[g]);
    $('#submit-guesses-btn').disabled = !allGuessed;

    // Show "Guess submitted" overlay
    const overlay = document.getElementById('guess-overlay');
    overlay.querySelector('.overlay-name').textContent = currentGuesser;
    overlay.classList.add('visible');

    setTimeout(() => {
      overlay.classList.remove('visible');
      btn.classList.remove('locked');
      optionsEl.classList.remove('locked');
      guessLocked = false;

      if (nextUn) {
        currentGuesser = nextUn;
        $$('.guesser-tab').forEach(t => t.classList.remove('active'));
        tabsEl.querySelector(`[data-guesser="${nextUn}"]`).classList.add('active');
        updateGuessUI(nextUn);
      }
    }, 1200);
  };

  showScreen('guess');

  startTimer(
    state.timerSeconds,
    $('#guess-timer-fill'),
    $('#guess-timer-text'),
    $('#guess-timer'),
    () => {
      // Auto-fill random guesses for anyone who hasn't picked
      guessers.forEach(g => {
        if (!state.guesses[g]) {
          state.guesses[g] = options[Math.floor(Math.random() * options.length)];
        }
      });
      $('#submit-guesses-btn').click();
    }
  );
}

function updateGuessUI(guesser) {
  $('#guesser-label').textContent = `${guesser}'s guess`;
  const selected = state.guesses[guesser];
  $$('.guess-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.prompt === selected);
  });
}

// ============================================================
//  REVEAL RESULTS
// ============================================================
$('#submit-guesses-btn').addEventListener('click', () => {
  stopTimer();
  const ranker = state.players[state.rankerIndex];
  const guessers = state.players.filter(p => p !== ranker);

  let correctCount = 0;
  guessers.forEach(name => {
    if (state.guesses[name] === state.currentPrompt) {
      state.streaks[name] = (state.streaks[name] || 0) + 1;
      const streakBonus = (state.streaks[name] - 1) * 50;
      let speedBonus = 0;
      if (state.timerSeconds > 0 && state.guessTimestamps[name] != null) {
        speedBonus = Math.round((state.guessTimestamps[name] / state.timerSeconds) * 50);
      }
      const pts = 100 + streakBonus + speedBonus;
      state.roundScores[name] = pts;
      state.scores[name] = (state.scores[name] || 0) + pts;
      correctCount++;
    } else {
      state.streaks[name] = 0;
    }
  });

  // Creator bonus: +50 if a custom prompt was picked
  const creator = state.currentPromptCreator;
  if (creator && state.players.includes(creator) && creator !== ranker) {
    state.roundScores[creator] = (state.roundScores[creator] || 0) + 50;
    state.scores[creator] = (state.scores[creator] || 0) + 50;
  }

  if (correctCount > 0) { SFX.correct(); haptic([50, 30, 100]); }
  else { SFX.wrong(); haptic(200); }
  showResults(correctCount, guessers.length);
});

function showResults(correctCount, totalGuessers) {
  const ranker = state.players[state.rankerIndex];

  $('#result-round-label').textContent = getRoundLabel();
  $('#result-prompt-text').innerHTML = state.currentPrompt +
    (state.currentPromptCreator ? `<div class="creator-bonus" style="margin-top:6px;">Written by ${state.currentPromptCreator} (+50 bonus!)</div>` : '');

  const banner = $('#result-banner');
  if (correctCount === 0) {
    banner.className = 'result-banner wrong-banner';
    banner.textContent = 'Nobody got it right!';
  } else if (correctCount === totalGuessers) {
    banner.className = 'result-banner correct-banner';
    banner.textContent = 'Everyone got it!';
  } else {
    banner.className = 'result-banner correct-banner';
    banner.textContent = `${correctCount}/${totalGuessers} guessed correctly!`;
  }

  const roundScoresEl = $('#round-scores');
  const guessers = state.players.filter(p => p !== ranker);
  const creator = state.currentPromptCreator;
  roundScoresEl.innerHTML = guessers.map(name => {
    const guessedRight = state.guesses[name] === state.currentPrompt;
    const isCreator = creator && name === creator;
    const pts = state.roundScores[name] || 0;
    const streak = state.streaks[name] || 0;
    let label = '';
    if (guessedRight && isCreator) label = '&#10003; + prompt bonus';
    else if (guessedRight) label = '&#10003;';
    else if (isCreator) label = 'prompt bonus';
    else label = '&#10007;';
    if (streak >= 2) label += ` (${streak}x streak!)`;
    if (guessedRight && state.timerSeconds > 0 && state.guessTimestamps[name] != null) {
      const sb = Math.round((state.guessTimestamps[name] / state.timerSeconds) * 50);
      if (sb > 0) label += ` +${sb} speed`;
    }
    return `<div class="score-row">
      <span class="score-name">${name} ${label}</span>
      <span class="score-value">+${pts}</span>
    </div>`;
  }).join('') +
  `<div class="score-row ranker">
    <span class="score-name">${ranker}</span>
    <span class="score-value">-</span>
  </div>`;

  renderTotalScores('#total-scores');

  const isLastTurn = state.currentRound >= state.totalRounds && state.currentTurnInRound >= state.players.length;
  const nextBtn = $('#next-round-btn');
  nextBtn.textContent = isLastTurn ? 'See Final Scores' : 'Next';

  showScreen('result');
}

function renderTotalScores(selector) {
  const el = $(selector);
  const sorted = [...state.players].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0));
  el.innerHTML = sorted.map(name =>
    `<div class="score-row">
      <span class="score-name">${name}</span>
      <span class="score-value">${state.scores[name] || 0}</span>
    </div>`
  ).join('');
}

// ============================================================
//  NEXT TURN / NEXT ROUND / GAME OVER
// ============================================================
$('#next-round-btn').addEventListener('click', () => {
  const isLastTurn = state.currentRound >= state.totalRounds && state.currentTurnInRound >= state.players.length;
  if (isLastTurn) {
    showGameOver();
  } else {
    state.rankerIndex = (state.rankerIndex + 1) % state.players.length;
    if (state.currentTurnInRound >= state.players.length) {
      state.currentRound++;
      state.currentTurnInRound = 0;
    }
    startTurn();
  }
});

function showGameOver() {
  if (state.usedCustomPrompts.length >= 2) {
    showVoteScreen();
  } else {
    showFinalGameOver(null);
  }
}

function showFinalGameOver(bestPrompt) {
  const sorted = [...state.players].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0));
  const topScore = state.scores[sorted[0]] || 0;
  const winners = sorted.filter(p => (state.scores[p] || 0) === topScore);

  if (winners.length === 1) {
    $('#winner-text').textContent = `${winners[0]} wins!`;
  } else {
    $('#winner-text').textContent = `It's a tie! ${winners.join(' & ')}`;
  }

  const bpEl = $('#best-prompt-result');
  if (bestPrompt) {
    bpEl.innerHTML = `<div class="best-prompt-card">
      <div class="best-label">Best Prompt</div>
      <div class="best-text">${bestPrompt.text}</div>
      <div class="best-meta">by ${bestPrompt.creator} - ${bestPrompt.votes} vote${bestPrompt.votes !== 1 ? 's' : ''}</div>
    </div>`;
  } else {
    bpEl.innerHTML = '';
  }

  renderTotalScores('#final-scores');
  SFX.victory(); haptic([50, 50, 50, 50]);
  showScreen('gameover');
  launchConfetti();
}

// ============================================================
//  BEST PROMPT VOTE
// ============================================================
function showVoteScreen() {
  state.promptVotes = {};

  const tabsEl = $('#voter-tabs');
  tabsEl.innerHTML = state.players.map((name, i) =>
    `<button class="guesser-tab ${i === 0 ? 'active' : ''}" data-voter="${name}">${name}</button>`
  ).join('');

  const optionsEl = $('#vote-options');
  optionsEl.innerHTML = state.usedCustomPrompts.map((p, i) =>
    `<button class="vote-option" data-index="${i}">
      ${p.text}
      <span class="vote-creator">by ${p.creator}</span>
    </button>`
  ).join('');

  let currentVoter = state.players[0];
  updateVoteUI(currentVoter);

  tabsEl.onclick = (e) => {
    if (e.target.classList.contains('guesser-tab')) {
      currentVoter = e.target.dataset.voter;
      $$('#voter-tabs .guesser-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      updateVoteUI(currentVoter);
    }
  };

  optionsEl.onclick = (e) => {
    const btn = e.target.closest('.vote-option');
    if (!btn) return;
    const idx = +btn.dataset.index;
    state.promptVotes[currentVoter] = idx;
    SFX.tap(); haptic(15);

    const tab = tabsEl.querySelector(`[data-voter="${currentVoter}"]`);
    if (tab) tab.classList.add('guessed');
    updateVoteUI(currentVoter);

    const nextUn = state.players.find(p => state.promptVotes[p] == null && p !== currentVoter);
    const allVoted = state.players.every(p => state.promptVotes[p] != null);
    $('#submit-votes-btn').disabled = !allVoted;

    if (nextUn) {
      setTimeout(() => {
        currentVoter = nextUn;
        $$('#voter-tabs .guesser-tab').forEach(t => t.classList.remove('active'));
        tabsEl.querySelector(`[data-voter="${nextUn}"]`).classList.add('active');
        updateVoteUI(nextUn);
      }, 400);
    }
  };

  showScreen('vote');
}

function updateVoteUI(voter) {
  $('#voter-label').textContent = `${voter}'s pick`;
  const selected = state.promptVotes[voter];
  $$('.vote-option').forEach((opt, i) => {
    opt.classList.toggle('selected', i === selected);
  });
}

$('#submit-votes-btn').addEventListener('click', () => {
  const tally = {};
  state.usedCustomPrompts.forEach((_, i) => tally[i] = 0);
  Object.values(state.promptVotes).forEach(idx => {
    tally[idx] = (tally[idx] || 0) + 1;
  });

  let bestIdx = 0;
  let bestCount = 0;
  Object.entries(tally).forEach(([idx, count]) => {
    if (count > bestCount) { bestIdx = +idx; bestCount = count; }
  });

  const best = state.usedCustomPrompts[bestIdx];
  showFinalGameOver({ text: best.text, creator: best.creator, votes: bestCount });
});

// ============================================================
//  SHARE RESULTS
// ============================================================
$('#share-results-btn').addEventListener('click', () => {
  const sorted = [...state.players].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0));
  const lines = ['Rank & Guess - Final Scores', ''];
  sorted.forEach((name, i) => {
    const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`;
    lines.push(`${medal}: ${name} - ${state.scores[name] || 0} pts`);
  });
  lines.push('', 'Play at: https://djsaunders1997.github.io/id-game/');

  const text = lines.join('\n');

  if (navigator.share) {
    navigator.share({ title: 'Rank & Guess Results', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = $('#share-results-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share Results'; }, 2000);
    }).catch(() => {});
  }
  SFX.tap(); haptic(15);
});

$('#play-again-btn').addEventListener('click', () => {
  state.currentRound = 1;
  state.currentTurnInRound = 0;
  state.rankerIndex = 0;
  state.usedPrompts = [];
  state.currentPromptCreator = null;
  state.scores = {};
  state.streaks = {};
  state.usedCustomPrompts = [];
  state.promptVotes = {};
  state.players.forEach(p => { state.scores[p] = 0; state.streaks[p] = 0; });

  if (state.activeCategories.includes('custom')) {
    state.customPrompts = [];
    state.submitPlayerIndex = 0;
    showSubmitScreen();
  } else {
    buildPoolAndStart();
  }
});

$('#new-game-btn').addEventListener('click', () => {
  state.customPrompts = [];
  state.totalRounds = 2;
  state.submitPlayerIndex = 0;
  state.currentPromptCreator = null;
  state.activeCategories = ['standard'];
  $$('.pack-card').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === 'standard');
  });
  $('#rounds-num').textContent = '2';
  renderPlayers();
  renderCustomPrompts();
  updateActiveCategories();
  showScreen('home');
});

// ============================================================
//  INIT
// ============================================================
initCategoryToggles();
renderPlayers();
renderCustomPrompts();
updateActiveCategories();
