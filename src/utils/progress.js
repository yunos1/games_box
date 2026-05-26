import { games } from "../data/games";
import { getAllLeaderboards, getBestScore, getProgress, getSavedValue, setSavedValue } from "./storage";

const CHALLENGE_KEY = "daily-challenge";
const STAR_KEY = "game-stars";
const DAILY_RULE_RESULT_KEY = "daily-rule-results";

export const dailyVariantDefinitions = {
  "2048": [
    {
      id: "high-energy",
      title: "高能生成",
      detail: "新方块更容易出现 4，开局会多生成两个方块。",
      effect: "rich-spawn",
    },
    {
      id: "chain-bonus",
      title: "连锁加成",
      detail: "每次合并获得额外分数，适合冲排行榜。",
      effect: "score-boost",
    },
    {
      id: "move-limit",
      title: "限步聚变",
      detail: "160 步内冲到 1024，否则本局提前结算。",
      effect: "move-limit",
    },
  ],
  snake: [
    {
      id: "turbo-core",
      title: "高速核心",
      detail: "移动节奏更快，但分数收益提高。",
      effect: "turbo",
    },
    {
      id: "gold-rush",
      title: "黄金能量",
      detail: "每隔几颗食物会出现高分黄金核心。",
      effect: "golden-food",
    },
    {
      id: "phase-wall",
      title: "相位边界",
      detail: "撞到墙壁会从另一侧穿出。",
      effect: "wrap-walls",
    },
  ],
  breakout: [
    {
      id: "reinforced-wall",
      title: "加固砖墙",
      detail: "前排砖块需要两次击中才会破碎。",
      effect: "reinforced-bricks",
    },
    {
      id: "wide-start",
      title: "宽板开局",
      detail: "挡板更宽，但球速略快。",
      effect: "wide-paddle",
    },
    {
      id: "one-life-clear",
      title: "一命清场",
      detail: "只有一条生命，清场奖励更高。",
      effect: "one-life",
    },
  ],
  "plane-war": [
    {
      id: "elite-rush",
      title: "精英突袭",
      detail: "敌机来得更密，击落奖励更高。",
      effect: "elite-rush",
    },
    {
      id: "piercing-beam",
      title: "穿透弹幕",
      detail: "主武器伤害提高，适合快速清场。",
      effect: "piercing-shot",
    },
    {
      id: "reserve-shield",
      title: "备用护盾",
      detail: "开局额外获得一层护盾。",
      effect: "extra-shield",
    },
  ],
};

export const starGoalDefinitions = {
  "2048": [
    {
      id: "score-512",
      title: "初级聚变",
      description: "单局分数达到 512。",
      test: ({ score = 0 }) => score >= 512,
    },
    {
      id: "tile-1024",
      title: "千级核心",
      description: "合成 1024 方块。",
      test: ({ maxTile = 0 }) => maxTile >= 1024,
    },
    {
      id: "efficient-1024",
      title: "精密滑行",
      description: "160 步内合成 1024。",
      test: ({ maxTile = 0, moves = Infinity }) => maxTile >= 1024 && moves <= 160,
    },
  ],
  snake: [
    {
      id: "five-cores",
      title: "连续进食",
      description: "单局吃到 5 个能量核心。",
      test: ({ foods = 0 }) => foods >= 5,
    },
    {
      id: "long-body",
      title: "长轨巡航",
      description: "身体长度达到 12。",
      test: ({ maxLength = 0 }) => maxLength >= 12,
    },
    {
      id: "hundred-score",
      title: "百点航线",
      description: "单局分数达到 100。",
      test: ({ score = 0 }) => score >= 100,
    },
  ],
  breakout: [
    {
      id: "twenty-bricks",
      title: "破墙者",
      description: "单局击碎 20 块砖。",
      test: ({ bricksBroken = 0 }) => bricksBroken >= 20,
    },
    {
      id: "full-clear",
      title: "清场完成",
      description: "击碎所有能量砖。",
      test: ({ cleared = false }) => cleared,
    },
    {
      id: "clean-clear",
      title: "完美反弹",
      description: "至少保留 2 条生命完成清场。",
      test: ({ cleared = false, livesLeft = 0 }) => cleared && livesLeft >= 2,
    },
  ],
  "plane-war": [
    {
      id: "ten-kills",
      title: "空域压制",
      description: "单局击落 10 架敌机。",
      test: ({ kills = 0 }) => kills >= 10,
    },
    {
      id: "score-300",
      title: "王牌火力",
      description: "单局分数达到 300。",
      test: ({ score = 0 }) => score >= 300,
    },
    {
      id: "no-hit-200",
      title: "无伤突围",
      description: "不受伤打到 200 分。",
      test: ({ score = 0, hitsTaken = 0 }) => score >= 200 && hitsTaken === 0,
    },
  ],
};

const genericStarGoals = [
  {
    id: "first-record",
    title: "点亮记录",
    description: "留下一次有效记录。",
    test: ({ best = 0, score = 0, won = false, completed = false }) => best > 0 || score > 0 || won || completed,
  },
  {
    id: "three-records",
    title: "稳定开局",
    description: "本地排行榜留下 3 条记录。",
    test: ({ recordCount = 0 }) => recordCount >= 3,
  },
  {
    id: "five-records",
    title: "熟练掌握",
    description: "本地排行榜留下 5 条记录。",
    test: ({ recordCount = 0 }) => recordCount >= 5,
  },
];

export const achievementDefinitions = [
  {
    id: "first-score",
    title: "信号点亮",
    description: "任意游戏获得分数或记录。",
    test: ({ bestScores }) => bestScores.some((item) => item.best > 0),
  },
  {
    id: "three-games",
    title: "多线程玩家",
    description: "3 款游戏留下记录。",
    test: ({ bestScores }) => bestScores.filter((item) => item.best > 0).length >= 3,
  },
  {
    id: "eight-games",
    title: "街机巡航",
    description: "8 款游戏留下记录。",
    test: ({ bestScores }) => bestScores.filter((item) => item.best > 0).length >= 8,
  },
  {
    id: "score-500",
    title: "能量过载",
    description: "任意游戏最佳记录达到 500。",
    test: ({ bestScores }) => bestScores.some((item) => item.best >= 500),
  },
  {
    id: "score-1000",
    title: "霓虹王牌",
    description: "任意游戏最佳记录达到 1000。",
    test: ({ bestScores }) => bestScores.some((item) => item.best >= 1000),
  },
  {
    id: "puzzle-core",
    title: "逻辑核心",
    description: "解谜或逻辑类游戏留下 3 项记录。",
    test: ({ bestScores }) =>
      bestScores.filter((item) => ["逻辑", "解谜", "益智", "消除"].includes(item.game.tag) && item.best > 0).length >= 3,
  },
  {
    id: "action-core",
    title: "反应炉",
    description: "动作、街机或反应类游戏留下 3 项记录。",
    test: ({ bestScores }) =>
      bestScores.filter((item) => ["动作", "街机", "反应"].includes(item.game.tag) && item.best > 0).length >= 3,
  },
  {
    id: "leaderboard-stack",
    title: "排行榜常客",
    description: "本地排行榜累计 10 条记录。",
    test: ({ leaderboard }) => leaderboard.length >= 10,
  },
  {
    id: "first-star",
    title: "目标点亮",
    description: "任意游戏获得 1 颗星级目标。",
    test: ({ starTotal }) => starTotal >= 1,
  },
  {
    id: "nine-stars",
    title: "星图成形",
    description: "累计获得 9 颗星级目标。",
    test: ({ starTotal }) => starTotal >= 9,
  },
  {
    id: "triple-star",
    title: "完美小局",
    description: "任意游戏拿满 3 颗星。",
    test: ({ starSummaries }) => starSummaries.some((item) => item.stars >= 3),
  },
  {
    id: "daily-rule-clear",
    title: "规则适应者",
    description: "完成一次今日规则变体。",
    test: ({ dailyRuleCount }) => dailyRuleCount >= 1,
  },
];

export const starRewardDefinitions = [
  {
    id: "neon-frame",
    stars: 3,
    title: "霓虹边框",
    description: "解锁星级卡片的高亮边框。",
  },
  {
    id: "focus-title",
    stars: 6,
    title: "专注玩家",
    description: "点亮首页玩家称号。",
  },
  {
    id: "daily-badge",
    stars: 9,
    title: "规则徽记",
    description: "今日规则完成时获得更醒目的徽记。",
  },
  {
    id: "star-map",
    stars: 15,
    title: "星图主题",
    description: "开启更完整的星图进度展示。",
  },
];

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashDate(value) {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1000003, 7);
}

function readStarState() {
  return getSavedValue(STAR_KEY, {});
}

function writeStarState(value) {
  setSavedValue(STAR_KEY, value);
}

function hasMeaningfulRun(metrics) {
  return Boolean(
    metrics.score > 0 ||
      metrics.won ||
      metrics.completed ||
      metrics.cleared ||
      metrics.bricksBroken > 0 ||
      metrics.kills > 0 ||
      metrics.foods > 0 ||
      metrics.survivedFrames > 600,
  );
}

function dateKeyFromValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mergeMetricBests(previous = {}, metrics = {}) {
  const next = { ...previous };
  Object.entries(metrics).forEach(([key, value]) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = Math.max(Number(next[key]) || 0, value);
    } else if (typeof value === "boolean") {
      next[key] = Boolean(next[key] || value);
    }
  });
  return next;
}

export function getTodayKey() {
  return todayKey();
}

export function getStarGoals(gameId) {
  return starGoalDefinitions[gameId] || genericStarGoals;
}

export function getDailyVariantForGame(gameId, date = todayKey()) {
  const variants = dailyVariantDefinitions[gameId] || [];
  if (!variants.length) return null;
  const seed = hashDate(`${date}:${gameId}`);
  return {
    date,
    gameId,
    ...variants[seed % variants.length],
  };
}

export function getDailyVariantHighlights(limit = 4) {
  const supportedIds = Object.keys(dailyVariantDefinitions);
  const date = todayKey();
  const seed = hashDate(date);
  return Array.from({ length: Math.min(limit, supportedIds.length) }, (_, index) => {
    const gameId = supportedIds[(seed + index * 5) % supportedIds.length];
    const game = games.find((item) => item.id === gameId);
    return {
      game,
      variant: getDailyVariantForGame(gameId, date),
    };
  }).filter((item) => item.game && item.variant);
}

export function getDailyVariantStatus(gameId, date = todayKey()) {
  const results = getSavedValue(DAILY_RULE_RESULT_KEY, {});
  return Boolean(results[date]?.[gameId]);
}

export function completeDailyVariant(gameId, metrics = {}, date = todayKey()) {
  const variant = getDailyVariantForGame(gameId, date);
  if (!variant || metrics.dailyVariantId !== variant.id || !hasMeaningfulRun(metrics)) {
    return false;
  }
  const results = getSavedValue(DAILY_RULE_RESULT_KEY, {});
  results[date] = {
    ...(results[date] || {}),
    [gameId]: {
      completedAt: new Date().toISOString(),
      variantId: variant.id,
      score: metrics.score || 0,
    },
  };
  setSavedValue(DAILY_RULE_RESULT_KEY, results);
  return true;
}

export function getDailyVariantCompletionCount() {
  const results = getSavedValue(DAILY_RULE_RESULT_KEY, {});
  return Object.values(results).reduce((total, dateResult) => total + Object.keys(dateResult || {}).length, 0);
}

export function getGameStarSummary(gameId) {
  const starState = readStarState();
  const stored = starState[gameId] || {};
  const progress = getProgress().games?.[gameId] || {};
  const goals = getStarGoals(gameId);
  const savedGoalIds = new Set(stored.unlockedGoalIds || []);
  const metrics = {
    ...(stored.bestMetrics || {}),
    best: getBestScore(gameId),
    recordCount: progress.recordCount || 0,
  };
  const evaluatedGoals = goals.map((goal) => {
    const unlocked = savedGoalIds.has(goal.id) || goal.test(metrics);
    return {
      ...goal,
      unlocked,
    };
  });
  return {
    stars: evaluatedGoals.filter((goal) => goal.unlocked).length,
    total: goals.length,
    goals: evaluatedGoals,
  };
}

export function getTotalStarCount() {
  return games.reduce((total, game) => total + getGameStarSummary(game.id).stars, 0);
}

export function getUnlockedRewards(starTotal = getTotalStarCount()) {
  return starRewardDefinitions.map((reward) => ({
    ...reward,
    progress: Math.min(starTotal, reward.stars),
    unlocked: starTotal >= reward.stars,
  }));
}

export function recordGameResult(gameId, metrics = {}) {
  const starState = readStarState();
  const stored = starState[gameId] || {};
  const progress = getProgress();
  const progressEntry = progress.games?.[gameId] || {};
  const metricContext = {
    ...metrics,
    best: getBestScore(gameId),
    recordCount: progressEntry.recordCount || 0,
  };
  const goals = getStarGoals(gameId);
  const previousGoalIds = new Set(stored.unlockedGoalIds || []);
  const currentGoalIds = goals.filter((goal) => goal.test(metricContext)).map((goal) => goal.id);
  const unlockedGoalIds = [...new Set([...previousGoalIds, ...currentGoalIds])];
  const newlyUnlocked = unlockedGoalIds.filter((id) => !previousGoalIds.has(id));
  const bestMetrics = mergeMetricBests(stored.bestMetrics, metricContext);
  const variantCompleted = completeDailyVariant(gameId, metrics);

  starState[gameId] = {
    unlockedGoalIds,
    bestStars: unlockedGoalIds.length,
    bestMetrics,
    updatedAt: new Date().toISOString(),
  };
  writeStarState(starState);

  const now = new Date().toISOString();
  progress.games = progress.games || {};
  progress.games[gameId] = {
    ...progressEntry,
    bestStars: unlockedGoalIds.length,
    lastStars: currentGoalIds.length,
    lastResultAt: now,
    bestMetrics,
  };
  progress.updatedAt = now;
  progress.lastPlayed = gameId;
  setSavedValue("progress", progress);

  return {
    stars: unlockedGoalIds.length,
    total: goals.length,
    newlyUnlocked,
    variantCompleted,
    goals: goals.map((goal) => ({
      ...goal,
      unlocked: unlockedGoalIds.includes(goal.id),
    })),
  };
}

export function getBestScores() {
  return games.map((game) => ({
    game,
    best: getBestScore(game.id),
  }));
}

export function getUnlockedAchievements() {
  const bestScores = getBestScores();
  const leaderboard = getAllLeaderboards(games.map((game) => game.id));
  const starSummaries = games.map((game) => ({
    gameId: game.id,
    ...getGameStarSummary(game.id),
  }));
  const starTotal = starSummaries.reduce((total, item) => total + item.stars, 0);
  const dailyRuleCount = getDailyVariantCompletionCount();
  return achievementDefinitions.map((achievement) => ({
    ...achievement,
    unlocked: achievement.test({ bestScores, leaderboard, starSummaries, starTotal, dailyRuleCount }),
  }));
}

export function getLeaderboardHighlights(limit = 5) {
  return getAllLeaderboards(games.map((game) => game.id))
    .map((entry) => ({
      ...entry,
      game: games.find((game) => game.id === entry.gameId),
    }))
    .filter((entry) => entry.game)
    .sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

export function getDailyChallenge() {
  const date = todayKey();
  const saved = getSavedValue(CHALLENGE_KEY, null);
  if (saved?.date === date) return saved;

  const seed = hashDate(date);
  const game = games[seed % games.length];
  const variants = [
    {
      kind: "best",
      title: "刷新记录",
      detail: `在 ${game.title} 中刷新一次本地最佳记录。`,
      reward: 120,
    },
    {
      kind: "record",
      title: "留下成绩",
      detail: `游玩 ${game.title}，让排行榜出现一条新记录。`,
      reward: 80,
    },
    {
      kind: "tag",
      title: "类型巡航",
      detail: `任选一款 ${game.tag} 类游戏，留下有效记录。`,
      reward: 100,
      tag: game.tag,
    },
  ];
  const challenge = {
    date,
    gameId: game.id,
    gameTitle: game.title,
    gameRoute: game.route,
    accent: game.accent,
    ...variants[Math.floor(seed / games.length) % variants.length],
  };
  setSavedValue(CHALLENGE_KEY, challenge);
  return challenge;
}

export function getDailyChallengeStatus(challenge = getDailyChallenge()) {
  const leaderboard = getAllLeaderboards(games.map((game) => game.id)).map((entry) => ({
    ...entry,
    game: games.find((game) => game.id === entry.gameId),
  }));
  const todayEntries = leaderboard.filter((entry) => dateKeyFromValue(entry.date) === challenge.date);

  if (challenge.kind === "best") {
    return todayEntries.some((entry) => entry.gameId === challenge.gameId && entry.isNewBest);
  }
  if (challenge.kind === "tag") {
    return todayEntries.some((entry) => entry.game?.tag === challenge.tag);
  }
  return todayEntries.some((entry) => entry.gameId === challenge.gameId);
}
