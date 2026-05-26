import { games, getGameById } from "../data/games";
import { getProgress } from "./storage";
import {
  getDailyChallenge,
  getDailyChallengeStatus,
  getDailyVariantHighlights,
  getDailyVariantStatus,
  getGameStarSummary,
} from "./progress";

export const campaignDefinitions = [
  {
    id: "starter",
    eyebrow: "STARTER ROUTE",
    title: "新手路线",
    detail: "短局、轻策略和即时反馈，适合快速进入状态。",
    accent: "#53f3ff",
    gameIds: ["guess-number", "2048", "link-link", "lights-out"],
  },
  {
    id: "logic",
    eyebrow: "LOGIC ROUTE",
    title: "逻辑路线",
    detail: "推演、观察和关卡解法，适合一关一关推进。",
    accent: "#facc15",
    gameIds: ["sudoku", "minesweeper", "laser-puzzle", "sokoban", "hanoi"],
  },
  {
    id: "arcade",
    eyebrow: "ARCADE ROUTE",
    title: "街机路线",
    detail: "节奏、反应和高压局，适合追求爽快反馈。",
    accent: "#ff4fd8",
    gameIds: ["snake", "breakout", "plane-war", "tetris", "flappy-bird"],
  },
  {
    id: "tactics",
    eyebrow: "TACTICS ROUTE",
    title: "策略路线",
    detail: "对弈、布阵和冒险推进，适合慢慢经营局面。",
    accent: "#7dff6f",
    gameIds: ["tic-tac-toe", "tower-defense", "gomoku", "reversi", "dungeon-rogue"],
  },
];

function progressForGame(gameId) {
  return getProgress().games?.[gameId] || {};
}

function buildNode(gameId, index, chapterId, previousCompleted = true) {
  const game = getGameById(gameId);
  if (!game) return null;
  const summary = getGameStarSummary(gameId);
  const progress = progressForGame(gameId);
  const hasRecord = Boolean(
    progress.best > 0 ||
      progress.recordCount > 0 ||
      progress.bestStars > 0 ||
      progress.lastScore > 0 ||
      progress.lastResultAt ||
      progress.lastPlayedAt,
  );
  const completed = summary.stars > 0 || hasRecord;
  const mastered = summary.stars >= summary.total;
  const state = mastered ? "mastered" : completed ? "completed" : previousCompleted ? "current" : "queued";

  return {
    chapterId,
    index,
    game,
    stars: summary.stars,
    total: summary.total,
    completed,
    mastered,
    state,
    remaining: Math.max(0, summary.total - summary.stars),
  };
}

export function getCampaignChapters() {
  return campaignDefinitions.map((chapter) => {
    let previousCompleted = true;
    const nodes = chapter.gameIds
      .map((gameId, index) => {
        const node = buildNode(gameId, index, chapter.id, previousCompleted);
        if (node) previousCompleted = node.completed;
        return node;
      })
      .filter(Boolean);
    const completed = nodes.filter((node) => node.completed).length;
    const mastered = nodes.filter((node) => node.mastered).length;
    const stars = nodes.reduce((total, node) => total + node.stars, 0);
    const totalStars = nodes.reduce((total, node) => total + node.total, 0);
    const current = nodes.find((node) => node.state === "current") || nodes.find((node) => !node.mastered) || nodes[nodes.length - 1];

    return {
      ...chapter,
      nodes,
      completed,
      mastered,
      stars,
      totalStars,
      total: nodes.length,
      percent: nodes.length ? Math.round((completed / nodes.length) * 100) : 0,
      current,
    };
  });
}

export function getCampaignSummary() {
  const chapters = getCampaignChapters();
  const nodes = chapters.flatMap((chapter) => chapter.nodes);
  const completed = nodes.filter((node) => node.completed).length;
  const mastered = nodes.filter((node) => node.mastered).length;
  const stars = nodes.reduce((total, node) => total + node.stars, 0);
  const totalStars = nodes.reduce((total, node) => total + node.total, 0);
  const nextNode = getNextCampaignNode();

  return {
    chapters,
    total: nodes.length,
    completed,
    mastered,
    stars,
    totalStars,
    percent: nodes.length ? Math.round((completed / nodes.length) * 100) : 0,
    nextNode,
  };
}

export function getNextCampaignNode(currentGameId = "") {
  const chapters = getCampaignChapters();
  if (currentGameId) {
    const chapter = chapters.find((item) => item.nodes.some((node) => node.game.id === currentGameId));
    if (chapter) {
      const currentIndex = chapter.nodes.findIndex((node) => node.game.id === currentGameId);
      const afterCurrent = chapter.nodes.slice(currentIndex + 1).find((node) => !node.completed);
      if (afterCurrent) return afterCurrent;
      const currentNode = chapter.nodes[currentIndex];
      if (currentNode && !currentNode.mastered) return currentNode;
    }
  }

  return (
    chapters.flatMap((chapter) => chapter.nodes).find((node) => node.state === "current") ||
    chapters.flatMap((chapter) => chapter.nodes).find((node) => !node.completed) ||
    chapters.flatMap((chapter) => chapter.nodes).find((node) => !node.mastered) ||
    null
  );
}

export function getStarFocusNode() {
  return getCampaignChapters()
    .flatMap((chapter) => chapter.nodes)
    .filter((node) => !node.mastered)
    .sort((a, b) => a.remaining - b.remaining || b.stars - a.stars || a.game.title.localeCompare(b.game.title, "zh-Hans-CN"))[0];
}

export function getQuestChain() {
  const challenge = getDailyChallenge();
  const challengeDone = getDailyChallengeStatus(challenge);
  const dailyRules = getDailyVariantHighlights(4);
  const ruleDoneCount = dailyRules.filter(({ game }) => getDailyVariantStatus(game.id)).length;
  const ruleTarget = dailyRules.find(({ game }) => !getDailyVariantStatus(game.id));
  const campaign = getCampaignSummary();
  const nextNode = campaign.nextNode;
  const starFocus = getStarFocusNode();

  return [
    {
      id: "daily-challenge",
      title: "今日挑战",
      detail: challenge.detail,
      route: challenge.gameRoute,
      accent: challenge.accent,
      done: challengeDone,
      progress: challengeDone ? "完成" : `${challenge.reward} XP`,
    },
    {
      id: "campaign-next",
      title: "推进地图",
      detail: nextNode ? `下一关：${nextNode.game.title}` : "关卡地图已经全部点亮。",
      route: "/campaign",
      accent: nextNode?.game.accent || "#53f3ff",
      done: !nextNode,
      progress: `${campaign.completed}/${campaign.total}`,
    },
    {
      id: "star-focus",
      title: "补一颗星",
      detail: starFocus ? `${starFocus.game.title} 还差 ${starFocus.remaining} 星。` : "所有路线都已经满星。",
      route: starFocus?.game.route || "/campaign",
      accent: starFocus?.game.accent || "#ffd166",
      done: !starFocus,
      progress: starFocus ? `${starFocus.stars}/${starFocus.total}` : "满星",
    },
    {
      id: "daily-rule",
      title: "今日规则",
      detail: ruleTarget ? `${ruleTarget.game.title} · ${ruleTarget.variant.title}` : "今日规则变体已清完。",
      route: ruleTarget?.game.route || "/campaign",
      accent: ruleTarget?.game.accent || "#7dff6f",
      done: !ruleTarget,
      progress: `${ruleDoneCount}/${dailyRules.length}`,
    },
  ];
}

export function getCampaignGamePool() {
  const campaignIds = new Set(campaignDefinitions.flatMap((chapter) => chapter.gameIds));
  return games.filter((game) => campaignIds.has(game.id));
}
