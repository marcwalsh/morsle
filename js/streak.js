// Persistent stats: streak, max streak, win distribution, today's progress.
// Stored in localStorage. Today's saved game stores guesses + per-tile
// result classes only — never the answer in plaintext.

const STATS_KEY = 'morsel.stats.v1';
const TODAY_KEY = 'morsel.today.v1';

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function defaultStats() {
  return {
    streak: 0,
    maxStreak: 0,
    lastWonDate: null,
    lastPlayedDate: null,
    gamesPlayed: 0,
    gamesWon: 0,
    distribution: [0, 0, 0, 0, 0, 0]
  };
}

export function getStats() {
  return { ...defaultStats(), ...load(STATS_KEY, {}) };
}

function previousDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export function recordWin(date, attempts) {
  const stats = getStats();
  if (stats.lastPlayedDate === date) return stats;
  if (stats.lastWonDate === previousDay(date)) stats.streak += 1;
  else stats.streak = 1;
  if (stats.streak > stats.maxStreak) stats.maxStreak = stats.streak;
  stats.lastWonDate = date;
  stats.lastPlayedDate = date;
  stats.gamesPlayed += 1;
  stats.gamesWon += 1;
  if (attempts >= 1 && attempts <= 6) stats.distribution[attempts - 1] += 1;
  save(STATS_KEY, stats);
  return stats;
}

export function recordLoss(date) {
  const stats = getStats();
  if (stats.lastPlayedDate === date) return stats;
  stats.streak = 0;
  stats.lastPlayedDate = date;
  stats.gamesPlayed += 1;
  save(STATS_KEY, stats);
  return stats;
}

// Today's mid-game state (so refresh resumes where you left off).
export function loadToday(date) {
  const data = load(TODAY_KEY, null);
  if (!data || data.date !== date) return null;
  return data;
}

export function saveToday(date, payload) {
  save(TODAY_KEY, { date, ...payload });
}

export function clearToday() {
  try { localStorage.removeItem(TODAY_KEY); } catch {}
}
