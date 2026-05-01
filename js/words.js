// Daily word resolution.
// The shipped source contains only ciphertexts; today's word is derived at
// runtime by deriving an index-specific key via SHA-256 and XOR-decrypting
// the entry for today's ET date.

import { ENCRYPTED_WORDS, WORD_SECRET, EPOCH_DATE } from './encrypted-words.js';

// 'YYYY-MM-DD' for today in America/New_York.
export function todayET() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(new Date());
}

function ymdToUtcMs(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function dayIndex(ymd = todayET()) {
  const days = Math.floor((ymdToUtcMs(ymd) - ymdToUtcMs(EPOCH_DATE)) / 86_400_000);
  return ((days % ENCRYPTED_WORDS.length) + ENCRYPTED_WORDS.length) % ENCRYPTED_WORDS.length;
}

export function msUntilMidnightET() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const [h, m, s] = fmt.format(now).split(':').map(Number);
  return ((24 - h) * 3600 - m * 60 - s) * 1000;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function deriveKey(index) {
  const bytes = new TextEncoder().encode(`${WORD_SECRET}-${index}`);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(buf);
}

export async function getDailyWord(ymd = todayET()) {
  const idx = dayIndex(ymd);
  const key = await deriveKey(idx);
  const ct = hexToBytes(ENCRYPTED_WORDS[idx]);
  const pt = new Uint8Array(ct.length);
  for (let i = 0; i < ct.length; i++) pt[i] = ct[i] ^ key[i % key.length];
  return new TextDecoder().decode(pt);
}

// SHA-256 hex of a string — used to verify guesses without exposing the answer.
export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
