import {
  Direction,
  DIRECTION_DELTA,
  TileType,
  BOT_TICK_MIN,
  BOT_TICK_MAX,
  type GameState,
  type Player,
  type Bomb,
} from './types';
import { movePlayer, placeBomb, isCellFree } from './game';

interface BotState {
  nextTick: number;
  lastAction: number;
}
const botStates = new Map<number, BotState>();

function getBotState(id: number): BotState {
  if (!botStates.has(id)) {
    botStates.set(id, {
      nextTick: BOT_TICK_MIN + Math.random() * (BOT_TICK_MAX - BOT_TICK_MIN),
      lastAction: 0,
    });
  }
  return botStates.get(id)!;
}

export function resetBotStates(): void {
  botStates.clear();
}

function buildBombSet(bombs: Bomb[]): Set<string> {
  const set = new Set<string>();
  for (const b of bombs) set.add(`${b.x},${b.y}`);
  return set;
}

function buildDangerSet(state: GameState): Set<string> {
  const danger = new Set<string>();
  for (const e of state.explosions) danger.add(`${e.x},${e.y}`);
  for (const bomb of state.bombs) {
    danger.add(`${bomb.x},${bomb.y}`);
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    for (const { dx, dy } of dirs) {
      for (let i = 1; i <= bomb.range; i++) {
        const bx = bomb.x + dx * i;
        const by = bomb.y + dy * i;
        if (bx < 0 || bx >= state.cols || by < 0 || by >= state.rows) break;
        const tile = state.map[by][bx];
        if (tile === TileType.WALL || tile === TileType.BREAKABLE) break;
        danger.add(`${bx},${by}`);
      }
    }
  }
  return danger;
}

function findSafeCell(state: GameState, startX: number, startY: number, dangerSet: Set<string>, bombSet: Set<string>): Direction | null {
  const visited = new Set<string>();
  const queue: { x: number; y: number; firstDir: Direction | null }[] = [];
  visited.add(`${startX},${startY}`);
  const dirs: Direction[] = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
  for (const dir of dirs) {
    const delta = DIRECTION_DELTA[dir];
    const nx = startX + delta.x;
    const ny = startY + delta.y;
    const key = `${nx},${ny}`;
    if (visited.has(key)) continue;
    if (!isCellFree(state, nx, ny)) continue;
    if (bombSet.has(key)) continue;
    visited.add(key);
    if (!dangerSet.has(key)) return dir;
    queue.push({ x: nx, y: ny, firstDir: dir });
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dir of dirs) {
      const delta = DIRECTION_DELTA[dir];
      const nx = current.x + delta.x;
      const ny = current.y + delta.y;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (!isCellFree(state, nx, ny)) continue;
      if (bombSet.has(key)) continue;
      visited.add(key);
      if (!dangerSet.has(key)) return current.firstDir;
      queue.push({ x: nx, y: ny, firstDir: current.firstDir });
    }
  }
  return null;
}

function hasEscapeRoute(state: GameState, player: Player): boolean {
  const simulatedBomb: Bomb = {
    x: player.x,
    y: player.y,
    ownerId: player.id,
    timer: 2000,
    range: player.bombRange,
    placed: state.elapsed,
  };
  const simulatedState = { ...state, bombs: [...state.bombs, simulatedBomb] };
  const dangerSet = buildDangerSet(simulatedState);
  const bombSet = buildBombSet(simulatedState.bombs);
  return findSafeCell(simulatedState, player.x, player.y, dangerSet, bombSet) !== null;
}

function isAdjacentToTarget(state: GameState, player: Player): boolean {
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  for (const { dx, dy } of dirs) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) continue;
    if (state.map[ny][nx] === TileType.BREAKABLE) return true;
    const enemy = state.players.find((p) => p.id !== player.id && p.alive && p.x === nx && p.y === ny);
    if (enemy) return true;
  }
  return false;
}

function findTargetDirection(state: GameState, player: Player, dangerSet: Set<string>, bombSet: Set<string>): Direction | null {
  const visited = new Set<string>();
  const queue: { x: number; y: number; firstDir: Direction }[] = [];
  visited.add(`${player.x},${player.y}`);
  const dirs: Direction[] = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  for (const dir of dirs) {
    const delta = DIRECTION_DELTA[dir];
    const nx = player.x + delta.x;
    const ny = player.y + delta.y;
    const key = `${nx},${ny}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) continue;
    if (state.map[ny][nx] === TileType.BREAKABLE) return null;
    if (!isCellFree(state, nx, ny)) continue;
    if (bombSet.has(key)) continue;
    if (dangerSet.has(key)) continue;
    queue.push({ x: nx, y: ny, firstDir: dir });
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dir of dirs) {
      const delta = DIRECTION_DELTA[dir];
      const nx = current.x + delta.x;
      const ny = current.y + delta.y;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) continue;
      if (state.map[ny][nx] === TileType.BREAKABLE) return current.firstDir;
      const enemy = state.players.find((p) => p.id !== player.id && p.alive && p.x === nx && p.y === ny);
      if (enemy) return current.firstDir;
      if (!isCellFree(state, nx, ny)) continue;
      if (bombSet.has(key)) continue;
      if (dangerSet.has(key)) continue;
      queue.push({ x: nx, y: ny, firstDir: current.firstDir });
    }
  }
  const safeDirs = dirs.filter((dir) => {
    const delta = DIRECTION_DELTA[dir];
    const nx = player.x + delta.x;
    const ny = player.y + delta.y;
    const key = `${nx},${ny}`;
    return isCellFree(state, nx, ny) && !dangerSet.has(key) && !bombSet.has(key);
  });
  return safeDirs.length > 0 ? safeDirs[Math.floor(Math.random() * safeDirs.length)] : null;
}

export function updateBot(state: GameState, player: Player, dt: number): GameState {
  if (!player.alive || !player.isBot || player.moving) return state;
  const botState = getBotState(player.id);
  botState.lastAction += dt;
  if (botState.lastAction < botState.nextTick) return state;
  botState.lastAction = 0;
  botState.nextTick = BOT_TICK_MIN + Math.random() * (BOT_TICK_MAX - BOT_TICK_MIN);
  const dangerSet = buildDangerSet(state);
  const bombSet = buildBombSet(state.bombs);
  const playerKey = `${player.x},${player.y}`;
  if (dangerSet.has(playerKey)) {
    const escapeDir = findSafeCell(state, player.x, player.y, dangerSet, bombSet);
    if (escapeDir) return movePlayer(state, player.id, escapeDir);
    return state;
  }
  if (isAdjacentToTarget(state, player) && hasEscapeRoute(state, player)) {
    if (player.activeBombs < player.maxBombs && Math.random() < 0.7) return placeBomb(state, player.id);
  }
  const targetDir = findTargetDirection(state, player, dangerSet, bombSet);
  if (targetDir === null) {
    if (isAdjacentToTarget(state, player) && hasEscapeRoute(state, player)) return placeBomb(state, player.id);
    return state;
  }
  return movePlayer(state, player.id, targetDir);
}
