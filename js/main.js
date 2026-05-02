// Boot and event wiring.

import { MORSE, ensureAudio, playMorse, playWord, morseDurationMs } from './morse.js';
import { initGame, handleKey, canPlay, playCode, isInModalContext } from './game.js';
import { msUntilMidnightET } from './words.js';
import { getStats } from './streak.js';

function renderChart() {
  const grid = document.getElementById('chart-grid');
  grid.innerHTML = Object.entries(MORSE).map(([l, c]) =>
    `<button class="chart-cell" type="button" data-letter="${l}" aria-label="${l}: ${c}">
      <span class="chart-letter">${l}</span>
      <span class="chart-code">${c}</span>
    </button>`
  ).join('');
  grid.querySelectorAll('.chart-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      ensureAudio();
      playMorse(MORSE[cell.dataset.letter]);
    });
  });
}

function pad2(n) { return n.toString().padStart(2, '0'); }

function renderStats() {
  const s = getStats();
  document.getElementById('streak-display').textContent = s.streak;
  document.getElementById('stat-streak').textContent = s.streak;
  document.getElementById('stat-max').textContent = s.maxStreak;
  document.getElementById('stat-played').textContent = s.gamesPlayed;
  const winPct = s.gamesPlayed ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;
  document.getElementById('stat-winpct').textContent = `${winPct}%`;

  const max = Math.max(1, ...s.distribution);
  const dist = document.getElementById('stat-distribution');
  dist.innerHTML = s.distribution.map((count, i) => {
    const pct = Math.max(8, (count / max) * 100);
    return `<div class="dist-row">
      <span class="dist-label">${i + 1}</span>
      <div class="dist-bar"><div class="dist-fill" style="width:${pct}%">${count}</div></div>
    </div>`;
  }).join('');
}

let countdownTimer;
function startCountdown() {
  const el = document.getElementById('next-countdown');
  if (!el) return;
  function tick() {
    const ms = msUntilMidnightET();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    el.textContent = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    if (ms <= 1000) {
      // New day arrived — reload to load the new word.
      setTimeout(() => location.reload(), 1500);
    }
  }
  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
}

function openModal(id) {
  document.getElementById(id).hidden = false;
  if (id === 'modal-stats') renderStats();
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.hidden = true);
}

function bindEvents() {
  document.addEventListener('keydown', e => {
    if (isInModalContext()) {
      if (e.key === 'Escape') closeAllModals();
      return;
    }
    const k = e.key.toUpperCase();
    if (k === 'ENTER') { e.preventDefault(); handleKey('ENTER'); }
    else if (e.key === 'Backspace') { e.preventDefault(); handleKey('BACK'); }
    else if (/^[A-Z]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      handleKey(k);
    }
  });

  document.getElementById('btn-help').addEventListener('click', () => openModal('modal-help'));
  document.getElementById('btn-chart').addEventListener('click', () => openModal('modal-chart'));
  document.getElementById('btn-stats').addEventListener('click', () => openModal('modal-stats'));
  document.getElementById('btn-play').addEventListener('click', () => {
    ensureAudio();
    playCode(buildLampVisuals());
  });

  document.querySelectorAll('.close-modal').forEach(b => {
    b.addEventListener('click', () => b.closest('.modal').hidden = true);
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.hidden = true; });
  });
}

function refreshPlayButton() {
  document.getElementById('btn-play').disabled = !canPlay();
}

// Replay one word (one row) sequentially, glowing each tile while its
// letter's Morse code plays.
async function playRowWithGlow(word, tiles) {
  ensureAudio();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < word.length; i++) {
    const tile = tiles[i];
    const code = MORSE[word[i]];
    const dur = morseDurationMs(code);
    playMorse(code, {
      onElement: (_t, durMs) => {
        if (!tile) return;
        tile.classList.add('lit');
        setTimeout(() => tile.classList.remove('lit'), durMs);
      }
    });
    await sleep(dur + 150);
  }
}

function buildLampVisuals() {
  const btn = document.getElementById('btn-play');
  const lamp = btn.querySelector('.play-lamp');
  btn.classList.add('playing');
  return {
    onElement: (_type, durMs) => {
      lamp.classList.add('lit');
      setTimeout(() => lamp.classList.remove('lit'), durMs);
    },
    onEnd: () => {
      btn.classList.remove('playing');
      lamp.classList.remove('lit');
    }
  };
}

async function boot() {
  bindEvents();
  renderChart();
  document.addEventListener('ditdah:state', refreshPlayButton);
  document.addEventListener('ditdah:submitted', () => {
    setTimeout(() => playCode(buildLampVisuals()), 600);
  });
  document.addEventListener('ditdah:replay-row', (e) => {
    const { word, tiles } = e.detail;
    playRowWithGlow(word, tiles);
  });
  await initGame({ onChange: renderStats });
  renderStats();
  refreshPlayButton();
  startCountdown();
}

boot();
