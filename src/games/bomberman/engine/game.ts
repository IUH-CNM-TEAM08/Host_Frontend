import {
  TileType,
  Direction,
  DIRECTION_DELTA,
  BOMB_TIMER,
  EXPLOSION_DURATION,
  type GameState,
  type Player,
  type Bomb,
  PowerUpType,
} from './types';

function isWalkable(state: GameState, gx: number, gy: number): boolean {
  if (gx < 0 || gx >= state.cols || gy < 0 || gy >= state.rows) return false;
  const tile = state.map[gy][gx];
  if (tile === TileType.WALL || tile === TileType.BREAKABLE) return false;
  if (state.bombs.some((b) => b.x === gx && b.y === gy)) return false;
  return true;
}

export function movePlayer(state: GameState, playerId: number, dir: Direction): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return state;
  const delta = DIRECTION_DELTA[dir];
  const nx = player.x + delta.x;
  const ny = player.y + delta.y;
  player.direction = dir;
  if (!isWalkable(state, nx, ny)) return state;
  player.visualX = player.x;
  player.visualY = player.y;
  player.x = nx;
  player.y = ny;
  player.moving = true;
  player.moveProgress = 0;
  collectPowerUp(state, player);
  return state;
}

function collectPowerUp(state: GameState, player: Player): void {
  const idx = state.powerUps.findIndex((p) => p.x === player.x && p.y === player.y && p.revealed);
  if (idx === -1) return;
  const pu = state.powerUps[idx];
  switch (pu.type) {
    case PowerUpType.BOMB_COUNT:
      player.maxBombs = Math.min(player.maxBombs + 1, 8);
      break;
    case PowerUpType.BOMB_RANGE:
      player.bombRange = Math.min(player.bombRange + 1, 6);
      break;
    case PowerUpType.SPEED:
      player.speed = Math.min(player.speed + 1, 3);
      break;
  }
  state.powerUps.splice(idx, 1);
}

export function placeBomb(state: GameState, playerId: number): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return state;
  if (player.activeBombs >= player.maxBombs) return state;
  if (state.bombs.some((b) => b.x === player.x && b.y === player.y)) return state;
  state.bombs.push({
    x: player.x,
    y: player.y,
    ownerId: playerId,
    timer: BOMB_TIMER,
    range: player.bombRange,
    placed: state.elapsed,
  });
  player.activeBombs++;
  return state;
}

function detonateBomb(state: GameState, bomb: Bomb): void {
  state.explosions.push({ x: bomb.x, y: bomb.y, timer: EXPLOSION_DURATION });
  const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  for (const { dx, dy } of dirs) {
    for (let i = 1; i <= bomb.range; i++) {
      const ex = bomb.x + dx * i;
      const ey = bomb.y + dy * i;
      if (ex < 0 || ex >= state.cols || ey < 0 || ey >= state.rows) break;
      const tile = state.map[ey][ex];
      if (tile === TileType.WALL) break;
      if (tile === TileType.BREAKABLE) {
        state.map[ey][ex] = TileType.EMPTY;
        state.explosions.push({ x: ex, y: ey, timer: EXPLOSION_DURATION });
        const pu = state.powerUps.find((p) => p.x === ex && p.y === ey && !p.revealed);
        if (pu) pu.revealed = true;
        break;
      }
      state.explosions.push({ x: ex, y: ey, timer: EXPLOSION_DURATION });
      const chainBomb = state.bombs.find((b) => b.x === ex && b.y === ey);
      if (chainBomb) chainBomb.timer = 0;
    }
  }
  const owner = state.players.find((p) => p.id === bomb.ownerId);
  if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);
}

function checkPlayerHits(state: GameState): void {
  for (const player of state.players) {
    if (!player.alive) continue;
    if (state.explosions.some((e) => e.x === player.x && e.y === player.y)) player.alive = false;
  }
}

function checkWinCondition(state: GameState): void {
  const human = state.players.find((p) => p.id === 0);
  if (human && !human.alive) {
    state.status = 'gameover';
    const aliveBot = state.players.find((p) => p.isBot && p.alive);
    state.winner = aliveBot ? aliveBot.id : null;
    return;
  }
  const aliveBots = state.players.filter((p) => p.isBot && p.alive);
  if (aliveBots.length === 0 && human && human.alive) {
    state.status = 'gameover';
    state.winner = 0;
  }
}

export function updateGame(state: GameState, dt: number): GameState {
  if (state.status !== 'playing') return state;
  state.elapsed += dt;
  const moveSpeed = 0.016;
  for (const player of state.players) {
    if (!player.alive) continue;
    if (player.moving) {
      player.moveProgress += dt * moveSpeed * player.speed;
      if (player.moveProgress >= 1) {
        player.moveProgress = 1;
        player.moving = false;
        player.visualX = player.x;
        player.visualY = player.y;
      } else {
        const prevX = player.x - DIRECTION_DELTA[player.direction].x;
        const prevY = player.y - DIRECTION_DELTA[player.direction].y;
        player.visualX = prevX + (player.x - prevX) * player.moveProgress;
        player.visualY = prevY + (player.y - prevY) * player.moveProgress;
      }
    } else {
      player.visualX = player.x;
      player.visualY = player.y;
    }
  }

  for (const bomb of state.bombs) bomb.timer -= dt;
  let hasDetonation = true;
  let safetyCounter = 0;
  while (hasDetonation && safetyCounter < 50) {
    safetyCounter++;
    hasDetonation = false;
    for (const bomb of state.bombs) {
      if (bomb.timer <= 0) {
        detonateBomb(state, bomb);
        hasDetonation = true;
      }
    }
    state.bombs = state.bombs.filter((b) => b.timer > 0);
  }

  for (const exp of state.explosions) exp.timer -= dt;
  checkPlayerHits(state);
  state.explosions = state.explosions.filter((e) => e.timer > 0);
  checkWinCondition(state);
  return state;
}

export function isCellFree(state: GameState, gx: number, gy: number): boolean {
  if (gx < 0 || gx >= state.cols || gy < 0 || gy >= state.rows) return false;
  return state.map[gy][gx] === TileType.EMPTY;
}
