import {
  TileType,
  PowerUpType,
  TILE_SIZE,
  BOMB_TIMER,
  type GameState,
  type Player,
  type Bomb,
  type Explosion,
  type PowerUp,
} from './engine/types';

export function getCanvasSize(state: GameState): { w: number; h: number } {
  return { w: state.cols * state.tileSize, h: state.rows * state.tileSize };
}

let cachedMapCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let cachedMapVersion = -1;
let cachedTileSize = 0;
let cachedMapDims = '';
let mapVersion = 0;

export function bumpMapVersion(): void {
  mapVersion++;
}

const spriteCache = new Map<number, HTMLCanvasElement>();
let spritesLoaded = false;

export function preloadSprites(imageSources: string[]): Promise<void> {
  if (spritesLoaded) return Promise.resolve();
  const spriteSize = TILE_SIZE;
  return Promise.all(
    imageSources.map((src, index) => new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = spriteSize;
        canvas.height = spriteSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve();
        const srcSize = Math.min(img.width, img.height) * 0.6;
        const srcX = (img.width - srcSize) / 2;
        const srcY = img.height * 0.05;
        ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, spriteSize, spriteSize);
        const imageData = ctx.getImageData(0, 0, spriteSize, spriteSize);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = r * 0.299 + g * 0.587 + b * 0.114;
          if (brightness < 35) data[i + 3] = 0;
          else if (brightness < 55) data[i + 3] = Math.floor(((brightness - 35) / 20) * 255);
        }
        ctx.putImageData(imageData, 0, 0);
        spriteCache.set(index, canvas);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    })),
  ).then(() => {
    spritesLoaded = true;
  });
}

interface MapTheme {
  floor: string;
  floorAlt: string;
  wall: string;
  wallHighlight: string;
  wallShadow: string;
  breakable: string;
  breakableHighlight: string;
  breakableShadow: string;
  breakableCrack: string;
}

const MAP_THEMES: Record<string, MapTheme> = {
  classic: {
    floor: '#2d2d2d', floorAlt: '#333333',
    wall: '#555555', wallHighlight: '#6a6a6a', wallShadow: '#3a3a3a',
    breakable: '#8b6914', breakableHighlight: '#a07818', breakableShadow: '#6d530f', breakableCrack: '#5a4210',
  },
  arena: {
    floor: '#1a2332', floorAlt: '#1e2838',
    wall: '#4a5568', wallHighlight: '#5a6578', wallShadow: '#2d3748',
    breakable: '#c53030', breakableHighlight: '#e53e3e', breakableShadow: '#9b2c2c', breakableCrack: '#742a2a',
  },
  maze: {
    floor: '#1a2e1a', floorAlt: '#1f351f',
    wall: '#2f5b2f', wallHighlight: '#3a7a3a', wallShadow: '#1a3a1a',
    breakable: '#6b4e0a', breakableHighlight: '#7d5c0e', breakableShadow: '#4a3507', breakableCrack: '#3a2a05',
  },
  desert: {
    floor: '#d4a94b', floorAlt: '#c99b3e',
    wall: '#8b6b3e', wallHighlight: '#a07f50', wallShadow: '#6b4e2a',
    breakable: '#c4944a', breakableHighlight: '#daa960', breakableShadow: '#9a7535', breakableCrack: '#7a5a28',
  },
};

let activeTheme: MapTheme = MAP_THEMES.classic;

function rebuildStaticCache(state: GameState): void {
  const { w, h } = getCanvasSize(state);
  const ts = state.tileSize;
  if (typeof OffscreenCanvas !== 'undefined') cachedMapCanvas = new OffscreenCanvas(w, h);
  else {
    cachedMapCanvas = document.createElement('canvas');
    cachedMapCanvas.width = w;
    cachedMapCanvas.height = h;
  }
  const ctx = cachedMapCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return;
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const px = col * ts;
      const py = row * ts;
      const tile = state.map[row][col];
      const alt = (row + col) % 2 === 0;
      drawFloor(ctx as CanvasRenderingContext2D, px, py, alt, ts);
      if (tile === TileType.WALL) drawWall(ctx as CanvasRenderingContext2D, px, py, ts);
      else if (tile === TileType.BREAKABLE) drawBreakable(ctx as CanvasRenderingContext2D, px, py, ts);
    }
  }
  cachedTileSize = ts;
}

function drawFloor(ctx: CanvasRenderingContext2D, px: number, py: number, alt: boolean, ts: number): void {
  ctx.fillStyle = alt ? activeTheme.floorAlt : activeTheme.floor;
  ctx.fillRect(px, py, ts, ts);
}

function drawWall(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  ctx.fillStyle = activeTheme.wall;
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = activeTheme.wallHighlight;
  ctx.fillRect(px + 2, py + 2, ts - 4, Math.max(2, Math.floor(ts / 12)));
}

function drawBreakable(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  ctx.fillStyle = activeTheme.breakable;
  ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
  ctx.fillStyle = activeTheme.breakableHighlight;
  ctx.fillRect(px + 1, py + 1, ts - 2, 2);
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, now: number, ts: number): void {
  if (!player.alive) return;
  const cx = player.visualX * ts + ts / 2;
  const cy = player.visualY * ts + ts / 2;
  const sprite = spriteCache.get(player.characterIndex);
  const bounce = player.moving ? Math.sin(player.moveProgress * Math.PI * 2) * -2 : Math.sin(now * 0.003 + player.id) * 1.5;
  if (sprite) ctx.drawImage(sprite, cx - ts * 0.45, cy - ts * 0.45 + bounce, ts * 0.9, ts * 0.9);
  else {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(cx, cy + bounce, ts * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBomb(ctx: CanvasRenderingContext2D, bomb: Bomb, gameTime: number, ts: number): void {
  const cx = bomb.x * ts + ts / 2;
  const cy = bomb.y * ts + ts / 2;
  const elapsed = gameTime - bomb.placed;
  const pulse = 1 + Math.sin((elapsed / BOMB_TIMER) * Math.PI * 8) * 0.08;
  const r = ts * 0.3 * pulse;
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion(ctx: CanvasRenderingContext2D, exp: Explosion, ts: number): void {
  const px = exp.x * ts;
  const py = exp.y * ts;
  ctx.fillStyle = '#ff5500';
  ctx.globalAlpha = Math.min(1, exp.timer / 200);
  ctx.fillRect(px, py, ts, ts);
  ctx.globalAlpha = 1;
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, ts: number): void {
  if (!pu.revealed) return;
  const cx = pu.x * ts + ts / 2;
  const cy = pu.y * ts + ts / 2;
  ctx.fillStyle = pu.type === PowerUpType.SPEED ? '#ffcc00' : pu.type === PowerUpType.BOMB_RANGE ? '#ff2200' : '#ff6600';
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.17, 0, Math.PI * 2);
  ctx.fill();
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, timestamp?: number): void {
  const now = timestamp ?? performance.now();
  const ts = state.tileSize;
  const { w: canvasW, h: canvasH } = getCanvasSize(state);
  ctx.clearRect(0, 0, canvasW, canvasH + 32);
  activeTheme = MAP_THEMES[state.mapId] || MAP_THEMES.classic;
  const dims = `${state.cols}x${state.rows}`;
  if (!cachedMapCanvas || cachedMapVersion !== mapVersion || cachedTileSize !== ts || cachedMapDims !== dims) {
    rebuildStaticCache(state);
    cachedMapVersion = mapVersion;
    cachedMapDims = dims;
  }
  if (cachedMapCanvas) ctx.drawImage(cachedMapCanvas as CanvasImageSource, 0, 0);
  for (const pu of state.powerUps) drawPowerUp(ctx, pu, ts);
  for (const bomb of state.bombs) drawBomb(ctx, bomb, state.elapsed, ts);
  for (const exp of state.explosions) drawExplosion(ctx, exp, ts);
  const players = state.players;
  for (let i = 1; i < players.length; i++) {
    const p = players[i];
    let j = i - 1;
    while (j >= 0 && players[j].visualY > p.visualY) {
      players[j + 1] = players[j];
      j--;
    }
    players[j + 1] = p;
  }
  for (const player of players) drawPlayer(ctx, player, now, ts);
}

export function invalidateMapCache(): void {
  cachedMapCanvas = null;
  cachedMapVersion = -1;
  cachedTileSize = 0;
  cachedMapDims = '';
  mapVersion = 0;
}
