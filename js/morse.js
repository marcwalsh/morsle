// Morse alphabet + Web Audio playback.

export const MORSE = {
  A: '.-',   B: '-...', C: '-.-.', D: '-..',  E: '.',
  F: '..-.', G: '--.',  H: '....', I: '..',   J: '.---',
  K: '-.-',  L: '.-..', M: '--',   N: '-.',   O: '---',
  P: '.--.', Q: '--.-', R: '.-.',  S: '...',  T: '-',
  U: '..-',  V: '...-', W: '.--',  X: '-..-', Y: '-.--', Z: '--..'
};

const FREQ = 600;
const DEFAULT_UNIT = 0.075;

let audioCtx;

export function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(start, dur) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = FREQ;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.22, start + 0.005);
  gain.gain.setValueAtTime(0.22, start + dur - 0.01);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// Schedules a Morse code string and returns its total duration in seconds.
// `opts.onElement(type, durationMs)` fires at the start of each dit/dah; it
// receives 'dit' or 'dah' and the audible duration in ms (so a visualiser can
// flash for exactly that long). `opts.onEnd()` fires when playback finishes.
export function playMorse(code, opts = {}) {
  ensureAudio();
  const unit = opts.unit ?? DEFAULT_UNIT;
  const { onElement, onEnd } = opts;
  let t = audioCtx.currentTime + 0.02;
  const startT = t;

  for (const ch of code) {
    if (ch === '.') {
      tone(t, unit);
      if (onElement) {
        const delay = Math.max(0, (t - audioCtx.currentTime) * 1000);
        const dur = unit * 1000;
        setTimeout(() => onElement('dit', dur), delay);
      }
      t += unit * 2;
    } else if (ch === '-') {
      tone(t, unit * 3);
      if (onElement) {
        const delay = Math.max(0, (t - audioCtx.currentTime) * 1000);
        const dur = unit * 3 * 1000;
        setTimeout(() => onElement('dah', dur), delay);
      }
      t += unit * 4;
    } else if (ch === ' ') {
      t += unit * 2;
    }
  }
  const totalMs = (t - startT) * 1000;
  if (onEnd) setTimeout(onEnd, totalMs);
  return t - startT;
}

export function morseDurationMs(code, unit = DEFAULT_UNIT) {
  let total = 0;
  for (const ch of code) {
    if (ch === '.') total += unit * 2;
    else if (ch === '-') total += unit * 4;
    else if (ch === ' ') total += unit * 2;
  }
  return total * 1000;
}

export function playLetter(letter, opts) {
  return playMorse(MORSE[letter], opts);
}

export function playWord(word, opts) {
  const code = word.split('').map(l => MORSE[l]).join(' ');
  return playMorse(code, opts);
}
