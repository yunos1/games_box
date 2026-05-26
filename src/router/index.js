import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";

export const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/marathon",
    name: "marathon",
    component: () => import("../views/MarathonView.vue"),
  },
  {
    path: "/game/guess-number",
    name: "guess-number",
    component: () => import("../games/GuessNumber.vue"),
  },
  {
    path: "/game/tic-tac-toe",
    name: "tic-tac-toe",
    component: () => import("../games/TicTacToe.vue"),
  },
  {
    path: "/game/snake",
    name: "snake",
    component: () => import("../games/SnakeGame.vue"),
  },
  {
    path: "/game/2048",
    name: "game-2048",
    component: () => import("../games/Game2048.vue"),
  },
  {
    path: "/game/breakout",
    name: "breakout",
    component: () => import("../games/BreakoutGame.vue"),
  },
  {
    path: "/game/flappy-bird",
    name: "flappy-bird",
    component: () => import("../games/FlappyBird.vue"),
  },
  {
    path: "/game/minesweeper",
    name: "minesweeper",
    component: () => import("../games/MinesweeperGame.vue"),
  },
  {
    path: "/game/tetris",
    name: "tetris",
    component: () => import("../games/TetrisGame.vue"),
  },
  {
    path: "/game/sokoban",
    name: "sokoban",
    component: () => import("../games/SokobanGame.vue"),
  },
  {
    path: "/game/plane-war",
    name: "plane-war",
    component: () => import("../games/PlaneWar.vue"),
  },
  {
    path: "/game/tank-battle",
    name: "tank-battle",
    component: () => import("../games/TankBattle.vue"),
  },
  {
    path: "/game/bomberman",
    name: "bomberman",
    component: () => import("../games/BombermanGame.vue"),
  },
  {
    path: "/game/sudoku",
    name: "sudoku",
    component: () => import("../games/SudokuGame.vue"),
  },
  {
    path: "/game/link-link",
    name: "link-link",
    component: () => import("../games/LinkLink.vue"),
  },
  {
    path: "/game/maze-runner",
    name: "maze-runner",
    component: () => import("../games/MazeRunner.vue"),
  },
  {
    path: "/game/laser-puzzle",
    name: "laser-puzzle",
    component: () => import("../games/LaserPuzzle.vue"),
  },
  {
    path: "/game/tower-defense",
    name: "tower-defense",
    component: () => import("../games/TowerDefense.vue"),
  },
  {
    path: "/game/dungeon-rogue",
    name: "dungeon-rogue",
    component: () => import("../games/DungeonRogue.vue"),
  },
  {
    path: "/game/rhythm-game",
    name: "rhythm-game",
    component: () => import("../games/RhythmGame.vue"),
  },
  {
    path: "/game/asteroid-dodge",
    name: "asteroid-dodge",
    component: () => import("../games/AsteroidDodge.vue"),
  },
  {
    path: "/game/bubble-shooter",
    name: "bubble-shooter",
    component: () => import("../games/BubbleShooter.vue"),
  },
  {
    path: "/game/zuma",
    name: "zuma",
    component: () => import("../games/ZumaGame.vue"),
  },
  {
    path: "/game/solitaire",
    name: "solitaire",
    component: () => import("../games/SolitaireGame.vue"),
  },
  {
    path: "/game/gomoku",
    name: "gomoku",
    component: () => import("../games/GomokuGame.vue"),
  },
  {
    path: "/game/reversi",
    name: "reversi",
    component: () => import("../games/ReversiGame.vue"),
  },
  {
    path: "/game/wordle-zh",
    name: "wordle-zh",
    component: () => import("../games/WordleZh.vue"),
  },
  {
    path: "/game/hanoi",
    name: "hanoi",
    component: () => import("../games/HanoiGame.vue"),
  },
  {
    path: "/game/lights-out",
    name: "lights-out",
    component: () => import("../games/LightsOut.vue"),
  },
  {
    path: "/game/fifteen-puzzle",
    name: "fifteen-puzzle",
    component: () => import("../games/FifteenPuzzle.vue"),
  },
  {
    path: "/game/snake-arena",
    name: "snake-arena",
    component: () => import("../games/SnakeArena.vue"),
  },
  {
    path: "/game/boss-rush",
    name: "boss-rush",
    component: () => import("../games/BossRush.vue"),
  },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});
