// Game state, evaluation, board/keyboard rendering, and the per-letter
// reveal animation that flips each tile in sync with its Morse audio.

import { MORSE, ensureAudio, playMorse, playWord, morseDurationMs } from './morse.js';
import { getDailyWord, todayET } from './words.js';
import { recordWin, recordLoss, loadToday, saveToday } from './streak.js';

const MAX_GUESSES = 6;
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['BACK','Z','X','C','V','B','N','M','ENTER']
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

let state;
let messageTimer;
let onStatsChange = () => {};

function emptyState(date, answer) {
  return {
    date,
    answer,
    guesses: [],
    results: [],
    current: '',
    status: 'playing',
    keyStates: {},
    locked: false
  };
}

export async function initGame({ onChange }) {
  if (onChange) onStatsChange = onChange;
  const date = todayET();
  const answer = await getDailyWord(date);
  const saved = loadToday(date);
  state = emptyState(date, answer);

  if (saved && Array.isArray(saved.guesses)) {
    for (let i = 0; i < saved.guesses.length; i++) {
      const guess = saved.guesses[i];
      const result = saved.results[i];
      state.guesses.push(guess);
      state.results.push(result);
      mergeKeyStates(guess, result);
    }
    state.status = saved.status || 'playing';
  }

  render();
  if (state.status === 'lost') {
    flashMessage(`Word was ${state.answer}. Tap ▶ to hear it.`, true);
  }
}

function mergeKeyStates(guess, result) {
  for (let i = 0; i < 5; i++) {
    const letter = guess[i];
    const cur = state.keyStates[letter];
    const next = result[i];
    if (cur === 'correct') continue;
    if (cur === 'present' && next !== 'correct') continue;
    state.keyStates[letter] = next;
  }
}

function evaluate(guess, answer) {
  const result = Array(5).fill('absent');
  const ans = answer.split('');
  for (let i = 0; i < 5; i++) {
    if (guess[i] === ans[i]) { result[i] = 'correct'; ans[i] = null; }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const idx = ans.indexOf(guess[i]);
    if (idx !== -1) { result[i] = 'present'; ans[idx] = null; }
  }
  return result;
}

function setMessage(msg) {
  document.getElementById('message').textContent = msg;
}

function flashMessage(msg, sticky = false) {
  setMessage(msg);
  clearTimeout(messageTimer);
  if (!sticky) {
    messageTimer = setTimeout(() => {
      if (state.status === 'playing') setMessage('');
    }, 1800);
  }
}

function currentRowEl() {
  return document.querySelectorAll('#board .row')[state.guesses.length];
}

function shakeRow() {
  const row = currentRowEl();
  if (!row || !row.animate) return;
  row.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-6px)' },
    { transform: 'translateX(6px)' },
    { transform: 'translateX(-3px)' },
    { transform: 'translateX(0)' }
  ], { duration: 320 });
}

export function handleKey(key) {
  if (state.status !== 'playing' || state.locked) return;
  if (key === 'ENTER') return submitGuess();
  if (key === 'BACK') {
    state.current = state.current.slice(0, -1);
    renderActiveRow();
    document.dispatchEvent(new CustomEvent('ditdah:state'));
    return;
  }
  if (state.current.length >= 5) return;
  if (!/^[A-Z]$/.test(key)) return;
  state.current += key;
  renderActiveRow();
  const tile = currentRowEl()?.children[state.current.length - 1];
  if (tile) {
    tile.classList.add('pop');
    setTimeout(() => tile.classList.remove('pop'), 140);
  }
  document.dispatchEvent(new CustomEvent('ditdah:state'));
}

async function submitGuess() {
  if (state.current.length !== 5) {
    flashMessage('Need 5 letters.');
    shakeRow();
    return;
  }
  ensureAudio();
  const guessedWord = state.current;
  const result = evaluate(guessedWord, state.answer);
  const rowEl = currentRowEl();
  state.locked = true;
  state.current = '';

  await revealRow(rowEl, guessedWord, result);

  state.guesses.push(guessedWord);
  state.results.push(result);
  mergeKeyStates(guessedWord, result);
  renderKeyboard();

  const won = guessedWord === state.answer;
  const exhausted = state.guesses.length >= MAX_GUESSES;

  if (won) {
    state.status = 'won';
    const lines = [
      'Got it. Clean copy.',
      'Loud and clear.',
      'Solid signal.',
      'Nicely done.',
      'Cutting it fine.',
      'Just in time.'
    ];
    flashMessage(lines[state.guesses.length - 1] || 'Got it.', true);
    recordWin(state.date, state.guesses.length);
    onStatsChange();
  } else if (exhausted) {
    state.status = 'lost';
    flashMessage(`Word was ${state.answer}. Tap ▶ to hear it.`, true);
    recordLoss(state.date);
    onStatsChange();
  }

  saveToday(state.date, {
    guesses: state.guesses,
    results: state.results,
    status: state.status
  });

  state.locked = false;
  document.dispatchEvent(new CustomEvent('ditdah:state'));
  document.dispatchEvent(new CustomEvent('ditdah:submitted'));
}

async function revealRow(rowEl, guess, result) {
  ensureAudio();
  for (let i = 0; i < 5; i++) {
    const tile = rowEl.children[i];
    const letter = guess[i];
    const cls = result[i];
    const code = MORSE[letter];
    const dur = morseDurationMs(code);

    tile.classList.add('flip');
    playMorse(code, {
      onElement: (_type, durMs) => {
        tile.classList.add('lit');
        setTimeout(() => tile.classList.remove('lit'), durMs);
      }
    });
    setTimeout(() => {
      tile.classList.add('filled');
      tile.classList.add(cls);
      const letterEl = tile.querySelector('.letter');
      if (letterEl) letterEl.textContent = letter;
    }, 250);
    await sleep(Math.max(dur + 200, 520));
    tile.classList.remove('flip');
  }
}

// --- Render -----------------------------------------------------------------

export function render() {
  renderBoard();
  renderKeyboard();
  document.dispatchEvent(new CustomEvent('ditdah:state'));
}

// The Play button plays the daily code (the puzzle's Morse audio) —
// always available, only locked while the player is mid-typing a guess.
export function canPlay() {
  if (!state) return false;
  return state.current.length === 0;
}

export function playCode(opts) {
  if (canPlay()) playAnswer(opts);
}

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    if (r < state.guesses.length) {
      const guessedWord = state.guesses[r];
      const tilesForRow = [];
      row.classList.add('guessed');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `Replay guess ${guessedWord} in Morse`);
      row.addEventListener('click', () => {
        ensureAudio();
        document.dispatchEvent(new CustomEvent('ditdah:replay-row', {
          detail: { word: guessedWord, tiles: tilesForRow }
        }));
      });
      // Stash tile refs once they're appended below so the visualiser can
      // glow each tile as its letter plays.
      queueMicrotask(() => {
        for (let i = 0; i < 5; i++) tilesForRow.push(row.children[i]);
      });
    }
    for (let c = 0; c < 5; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      let letter = '';
      let cls = '';
      if (r < state.guesses.length) {
        letter = state.guesses[r][c];
        cls = state.results[r][c];
      } else if (r === state.guesses.length) {
        letter = state.current[c] || '';
      }
      if (letter) {
        tile.classList.add('filled');
        if (cls) tile.classList.add(cls);
        tile.innerHTML = `<span class="letter">${letter}</span>`;
      }
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function renderActiveRow() {
  const rowEl = currentRowEl();
  if (!rowEl) return;
  for (let c = 0; c < 5; c++) {
    const tile = rowEl.children[c];
    const letter = state.current[c] || '';
    tile.className = 'tile';
    tile.innerHTML = '';
    if (letter) {
      tile.classList.add('filled');
      tile.innerHTML = `<span class="letter">${letter}</span>`;
    }
  }
}

function renderKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach(key => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key';
      btn.dataset.key = key;
      if (key === 'ENTER' || key === 'BACK') {
        btn.classList.add('wide');
        btn.classList.add(key === 'ENTER' ? 'enter' : 'back');
        btn.textContent = key;
        btn.setAttribute('aria-label', key === 'ENTER' ? 'Submit guess' : 'Delete letter');
      } else {
        btn.textContent = key;
        btn.setAttribute('aria-label', key);
        if (state.keyStates[key]) btn.classList.add(state.keyStates[key]);
      }
      btn.addEventListener('click', () => handleKey(key));
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
}

// --- Public helpers ---------------------------------------------------------

export function playAnswer(opts) {
  if (state?.answer) playWord(state.answer, opts);
}

export function isInModalContext() {
  return !!document.querySelector('.modal:not([hidden])');
}
