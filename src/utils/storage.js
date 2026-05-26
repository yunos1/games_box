const PREFIX = "neon-game-box:";

function readJson(key, fallback) {
  const raw = localStorage.getItem(`${PREFIX}${key}`);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
}

export function getBestScore(id, fallback = 0) {
  const value = Number(localStorage.getItem(`${PREFIX}${id}:best`));
  return Number.isFinite(value) ? value : fallback;
}

export function setBestScore(id, score) {
  const previous = getBestScore(id);
  const next = Math.max(previous, Number(score) || 0);
  localStorage.setItem(`${PREFIX}${id}:best`, String(next));
  recordScore(id, Number(score) || 0, next > previous);
  return next;
}

export function getSavedValue(key, fallback) {
  return readJson(key, fallback);
}

export function setSavedValue(key, value) {
  writeJson(key, value);
}

export function getLeaderboard(id) {
  return readJson(`${id}:leaderboard`, []);
}

export function getAllLeaderboards(gameIds) {
  return gameIds.flatMap((id) =>
    getLeaderboard(id).map((entry) => ({
      ...entry,
      gameId: id,
    })),
  );
}

export function recordScore(id, score, isNewBest = false) {
  if (!Number.isFinite(score) || score <= 0) return;

  const now = new Date().toISOString();
  const leaderboard = getLeaderboard(id);
  const withoutDuplicate = leaderboard.filter((entry) => entry.score !== score);
  const nextBoard = [{ score, date: now, isNewBest }, ...withoutDuplicate]
    .sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  writeJson(`${id}:leaderboard`, nextBoard);

  const progress = getProgress();
  progress.lastPlayed = id;
  progress.updatedAt = now;
  progress.games[id] = {
    ...(progress.games[id] || {}),
    best: getBestScore(id),
    lastScore: score,
    lastPlayedAt: now,
    recordCount: nextBoard.length,
  };
  writeJson("progress", progress);
}

export function getProgress() {
  return readJson("progress", {
    lastPlayed: "",
    updatedAt: "",
    games: {},
  });
}
