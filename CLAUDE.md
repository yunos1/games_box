# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言规则

**所有回复、代码注释、说明文档必须使用简体中文。** 这包括但不限于：
- 与用户的对话回复
- 代码中的注释（包括单行注释和多行注释）
- 提交信息（commit messages）
- 文档说明
- 变量名和函数名可以使用英文，但相关说明必须用中文

## Project Overview

**Neon Game Box** is a single-page Vue 3 application featuring 30+ browser-based arcade and puzzle games with a neon-themed UI. The project emphasizes local-first gameplay with persistent progress tracking, daily challenges, star-based achievements, and campaign progression.

## Development Commands

```bash
# Start development server (accessible on local network)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server runs on `0.0.0.0` to allow testing on mobile devices within the local network.

## Architecture

### Core Structure

- **Vue 3 + Vue Router**: Uses hash-based routing (`createWebHashHistory`) for static deployment compatibility
- **Component Architecture**:
  - `GameLayout.vue`: Shared wrapper for all games, handles topbar, HUD, star goals, daily variants, and result modals
  - Individual game components in `src/games/`: Each game is a self-contained `.vue` file with its own logic
  - `HomeView.vue`: Main hub with tabs (推荐/全部/街机/解谜/策略/进度), daily challenges, and progress tracking
  - `CampaignView.vue`: Campaign map with themed routes (starter/logic/arcade/tactics)
  - `MarathonView.vue`: Daily 5-game marathon mode

### Data Layer

All game state is stored in **localStorage** with the prefix `neon-game-box:`:

- **`src/utils/storage.js`**: Core persistence layer
  - `getBestScore(gameId)` / `setBestScore(gameId, score)`: Per-game high scores
  - `getLeaderboard(gameId)`: Top 5 scores per game
  - `getProgress()`: Global progress object tracking last played game, per-game stats, and timestamps

- **`src/utils/progress.js`**: Achievement and progression system
  - **Star Goals**: Each game has 3 star goals (defined in `starGoalDefinitions`). Some games have custom goals (2048, snake, breakout, plane-war), others use generic goals (first record, 3 records, 5 records)
  - **Daily Variants**: Games with `dailyVariantDefinitions` get daily rule modifiers (e.g., "high-energy" for 2048, "turbo-core" for snake). Variant selection is deterministic based on date hash
  - **Daily Challenge**: One game per day with a specific objective (刷新记录/留下成绩/类型巡航)
  - **Achievements**: Global milestones tracked in `achievementDefinitions`
  - **Star Rewards**: Unlocked at 3/6/9/15 total stars

- **`src/utils/campaign.js`**: Campaign progression
  - Four themed routes with predefined game sequences
  - Node states: `queued` → `current` → `completed` → `mastered` (3 stars)
  - Next node logic: advances when current node has any stars or records

- **`src/data/games.js`**: Central game registry
  - Each game has: `id`, `title`, `subtitle`, `tag`, `difficulty`, `route`, `icon`, `accent` color, `description`
  - `visibleGames` filters out games with `hidden: true` (e.g., zuma is currently hidden)

### Game Integration Pattern

When adding or modifying games:

1. **Game Component** (`src/games/GameName.vue`):
   - Import `GameLayout` and wrap game content in `<GameLayout :gameId="game-id" ...>`
   - Pass props: `status`, `score`, `best`, `moves`, `paused`, `showPause`, `progressVersion`, `runResult`
   - Emit events: `@restart`, `@toggle-pause`, `@dismiss-result`
   - Call `recordGameResult(gameId, metrics)` from `progress.js` when a run ends to update stars
   - Metrics object should include: `score`, `won`, `completed`, and any game-specific fields used in star goal tests
   - For daily variants: check `getDailyVariantForGame(gameId)` and include `dailyVariantId` in metrics

2. **Game Registry** (`src/data/games.js`):
   - Add game object to `games` array with all required fields
   - Import and reference the icon SVG from `src/assets/icons/`

3. **Router** (`src/router/index.js`):
   - Add route with lazy-loaded component: `{ path: "/game/game-id", name: "game-id", component: () => import("../games/GameName.vue") }`

4. **Star Goals** (optional, `src/utils/progress.js`):
   - Add custom goals to `starGoalDefinitions[gameId]` if the generic goals don't fit
   - Each goal needs: `id`, `title`, `description`, `test(metrics)` function

5. **Daily Variants** (optional, `src/utils/progress.js`):
   - Add variants to `dailyVariantDefinitions[gameId]` if the game supports rule modifiers
   - Each variant needs: `id`, `title`, `detail`, `effect` (used by game logic)

### Styling

- **`src/styles/theme.css`**: Global neon theme, color palette, typography, layout primitives
- **`src/styles/game.css`**: Game-specific UI components (topbar, HUD, result modals, dashboard panels)
- CSS custom properties for theming: `--accent` (per-game accent color), `--neon-*` colors
- Responsive breakpoints handled via media queries (e.g., `@media (max-width: 860px)` for compact meta cards)

### State Management

- **No Vuex/Pinia**: Uses Vue 3 Composition API with reactive refs and computed properties
- **KeepAlive**: `HomeView` is kept alive to preserve tab state when navigating to games
- **Query Parameters**: `fromTab` query param preserves home tab context when navigating between home and games
- **Progress Reactivity**: Components use `progressVersion` ref that increments on `onActivated` to trigger recomputation of progress-dependent computed properties

## Key Patterns

### Result Modal Flow

When a game ends:
1. Call `recordGameResult(gameId, metrics)` to update stars and check daily variant completion
2. Set `runResult` prop with: `{ title, detail, stats: [{ label, value }], stars, total, goals, newGoals, variantCompleted }`
3. `GameLayout` displays the modal with star progress, newly unlocked goals, and "next game" suggestion from campaign
4. User can restart, dismiss to view board, or navigate to next campaign node

### Daily Variant Completion

- Variant is marked complete only if: `metrics.dailyVariantId` matches today's variant AND `hasMeaningfulRun(metrics)` returns true
- Completion is stored in localStorage under `daily-rule-results` keyed by date and gameId
- Completion status is displayed in game HUD and home dashboard

### Campaign Progression

- Nodes unlock sequentially: next node becomes `current` when previous node has `completed: true` (any stars or records)
- `getNextCampaignNode(currentGameId)` returns the next incomplete node in the same chapter, or the current node if not mastered, or the first incomplete node globally
- Campaign summary shows aggregate progress: completed nodes, total stars, and next recommended node

## Common Tasks

### Adding a New Game

1. Create `src/games/NewGame.vue` with game logic wrapped in `<GameLayout>`
2. Add game entry to `src/data/games.js` with icon, accent color, and metadata
3. Add route to `src/router/index.js`
4. (Optional) Define custom star goals in `src/utils/progress.js`
5. (Optional) Add to a campaign route in `src/utils/campaign.js`

### Modifying Star Goals

Edit `starGoalDefinitions` in `src/utils/progress.js`. The `test` function receives a metrics object with all recorded game stats. Return `true` if the goal is met.

### Debugging Progress Issues

- Check localStorage in browser DevTools under `neon-game-box:*` keys
- `progress` key contains global state, `game-stars` contains star unlock state
- `daily-rule-results` contains daily variant completions keyed by date
- Clear specific keys or all `neon-game-box:*` keys to reset progress

### Testing Daily Variants

Daily variants are deterministic based on date. To test different variants, modify `todayKey()` in `src/utils/progress.js` to return a different date string.

## Technical Notes

- **No TypeScript**: Project uses plain JavaScript with JSDoc comments where needed
- **No Build-Time Linting**: No ESLint/Prettier config in repo; format manually or use editor defaults
- **Hash Router**: Uses `createWebHashHistory` for compatibility with static hosting (GitHub Pages, Cloudflare Pages)
- **Mobile Support**: Touch events handled via `src/utils/touch.js` for swipe gestures in applicable games
- **Starfield Background**: Animated starfield in `theme.css` using CSS animations on pseudo-elements
- **Icon System**: Uses `lucide-vue-next` for UI icons, custom SVGs for game icons in `src/assets/icons/`

## Deployment

The project is configured for static deployment:
- `wrangler.toml` suggests Cloudflare Pages deployment
- Build output goes to `dist/`
- Hash-based routing ensures all routes work without server-side configuration
