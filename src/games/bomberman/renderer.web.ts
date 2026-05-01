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
  return {
    w: state.cols * state.tileSize,
    h: state.rows * state.tileSize,
  };
}

let cachedMapCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let cachedMapVersion = -1;
let cachedTileSize = 0;
let cachedMapDims = '';
let mapVersion = 0;

export function bumpMapVersion(): void {
  mapVersion++;
}

function rebuildStaticCache(state: GameState): void {
  const { w, h } = getCanvasSize(state);
  const ts = state.tileSize;
  if (typeof OffscreenCanvas !== 'undefined') {
    cachedMapCanvas = new OffscreenCanvas(w, h);
  } else {
    cachedMapCanvas = document.createElement('canvas');
    cachedMapCanvas.width = w;
    cachedMapCanvas.height = h;
  }
  const ctx = cachedMapCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
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

const spriteCache = new Map<number, HTMLCanvasElement>();
let spritesLoaded = false;

export function preloadSprites(imageSources: string[]): Promise<void> {
  if (spritesLoaded) return Promise.resolve();
  const spriteSize = TILE_SIZE;
  return Promise.all(
    imageSources.map((src, index) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = spriteSize;
          canvas.height = spriteSize;
          const ctx = canvas.getContext('2d')!;
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
            else if (brightness < 55) data[i + 3] = Math.floor((brightness - 35) / 20 * 255);
          }
          ctx.putImageData(imageData, 0, 0);
          spriteCache.set(index, canvas);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    }),
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
  cross: {
    floor: '#201a2e', floorAlt: '#251f35',
    wall: '#5b2f8b', wallHighlight: '#7a3aaa', wallShadow: '#3a1a5a',
    breakable: '#7b5ea7', breakableHighlight: '#9070bb', breakableShadow: '#5a4080', breakableCrack: '#4a3068',
  },
  fortress: {
    floor: '#2e2a1a', floorAlt: '#353020',
    wall: '#8b7355', wallHighlight: '#a08a6a', wallShadow: '#5a4a35',
    breakable: '#b8860b', breakableHighlight: '#d4a017', breakableShadow: '#8b6508', breakableCrack: '#6b4e06',
  },
  desert: {
    floor: '#d4a94b', floorAlt: '#c99b3e',
    wall: '#8b6b3e', wallHighlight: '#a07f50', wallShadow: '#6b4e2a',
    breakable: '#c4944a', breakableHighlight: '#daa960', breakableShadow: '#9a7535', breakableCrack: '#7a5a28',
  },
};

let activeTheme: MapTheme = MAP_THEMES.classic;

const COLORS = {
  bombBody: '#1a1a1a',
  bombFuse: '#ff6600',
  bombHighlight: '#444444',
  shadow: 'rgba(0,0,0,0.3)',
};

function drawFloor(ctx: CanvasRenderingContext2D, px: number, py: number, alt: boolean, ts: number): void {
  ctx.fillStyle = alt ? activeTheme.floorAlt : activeTheme.floor;
  ctx.fillRect(px, py, ts, ts);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
}

function drawWall(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const inset = Math.max(1, Math.floor(ts / 24));
  const barH = Math.max(2, Math.floor(ts / 12));
  ctx.fillStyle = activeTheme.wall;
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = activeTheme.wallHighlight;
  ctx.fillRect(px + inset, py + inset, ts - inset * 2, barH);
  ctx.fillRect(px + inset, py + inset, barH, ts - inset * 2);
  ctx.fillStyle = activeTheme.wallShadow;
  ctx.fillRect(px + inset, py + ts - inset - barH, ts - inset * 2, barH);
  ctx.fillRect(px + ts - inset - barH, py + inset, barH, ts - inset * 2);
  ctx.strokeStyle = activeTheme.wallShadow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + ts / 2, py + inset);
  ctx.lineTo(px + ts / 2, py + ts - inset);
  ctx.moveTo(px + inset, py + ts / 2);
  ctx.lineTo(px + ts - inset, py + ts / 2);
  ctx.stroke();
}

function drawBreakable(ctx: CanvasRenderingContext2D, px: number, py: number, ts: number): void {
  const inset = 1;
  ctx.fillStyle = activeTheme.breakable;
  ctx.fillRect(px + inset, py + inset, ts - inset * 2, ts - inset * 2);
  ctx.strokeStyle = activeTheme.breakableShadow;
  ctx.lineWidth = 1;
  const brickH = (ts - inset * 2) / 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(px + inset, py + inset + brickH * i);
    ctx.lineTo(px + ts - inset, py + inset + brickH * i);
    ctx.stroke();
  }
  const brickW = (ts - inset * 2) / 2;
  for (let row = 0; row < 3; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let i = 1; i < 3; i++) {
      const lx = px + inset + brickW * i - brickW + offset;
      if (lx > px + inset && lx < px + ts - inset) {
        ctx.beginPath();
        ctx.moveTo(lx, py + inset + brickH * row);
        ctx.lineTo(lx, py + inset + brickH * (row + 1));
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = activeTheme.breakableHighlight;
  ctx.fillRect(px + inset, py + inset, ts - inset * 2, 2);
  ctx.strokeStyle = activeTheme.breakableCrack;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + ts * 0.3, py + ts * 0.4);
  ctx.lineTo(px + ts * 0.45, py + ts * 0.55);
  ctx.lineTo(px + ts * 0.35, py + ts * 0.7);
  ctx.stroke();
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, now: number, ts: number): void {
  if (!player.alive) return;
  const cx = player.visualX * ts + ts / 2;
  const cy = player.visualY * ts + ts / 2;
  const baseR = ts * 0.35;
  const spriteSize = ts * 0.9;
  const isMoving = player.moving;
  const bouncePhase = isMoving ? Math.sin(player.moveProgress * Math.PI * 2) : 0;
  const bounceY = bouncePhase * -3 * (ts / 48);
  const scaleX = isMoving ? 1 + Math.sin(player.moveProgress * Math.PI * 2) * 0.08 : 1;
  const scaleY = isMoving ? 1 - Math.sin(player.moveProgress * Math.PI * 2) * 0.08 : 1;
  const idleBob = isMoving ? 0 : Math.sin(now * 0.003 + player.id * 1.5) * 1.5 * (ts / 48);
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + baseR + 4 * (ts / 48), baseR * 0.9, baseR * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!player.isBot) {
    ctx.save();
    ctx.strokeStyle = player.color;
    ctx.lineWidth = Math.max(1, ts / 24);
    ctx.globalAlpha = 0.35 + Math.sin(now * 0.005) * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy + bounceY + idleBob, baseR + 4 * (ts / 48), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, cy + bounceY + idleBob);
  ctx.scale(scaleX, scaleY);
  const sprite = spriteCache.get(player.characterIndex);
  if (sprite) {
    ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
  } else {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(-baseR * 0.2, -baseR * 0.25, baseR * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  const fontSize = Math.max(7, Math.floor(ts * 0.19));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(player.isBot ? `B${player.id}` : 'YOU', cx, cy + baseR + 10 * (ts / 48));
}

function drawBomb(ctx: CanvasRenderingContext2D, bomb: Bomb, gameTime: number, ts: number): void {
  const cx = bomb.x * ts + ts / 2;
  const cy = bomb.y * ts + ts / 2;
  const elapsed = gameTime - bomb.placed;
  const progress = elapsed / BOMB_TIMER;
  const pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.08 * (1 + progress);
  const r = ts * 0.3 * pulse;
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r + 2, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.bombBody;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.bombHighlight;
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  const fuseScale = ts / 48;
  ctx.strokeStyle = COLORS.bombFuse;
  ctx.lineWidth = Math.max(1, 2 * fuseScale);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + 6 * fuseScale, cy - r - 8 * fuseScale, cx + 4 * fuseScale, cy - r - 12 * fuseScale);
  ctx.stroke();
  if (Math.sin(elapsed * 0.02) > 0) {
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(cx + 4 * fuseScale, cy - r - 12 * fuseScale, 3 * pulse * fuseScale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExplosion(ctx: CanvasRenderingContext2D, exp: Explosion, ts: number): void {
  const px = exp.x * ts;
  const py = exp.y * ts;
  const alpha = Math.min(1, exp.timer / 200);
  ctx.globalAlpha = alpha * 0.2;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(px, py, ts, ts);
  const inset1 = ts * 0.12;
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(px + inset1, py + inset1, ts - inset1 * 2, ts - inset1 * 2);
  const inset2 = ts * 0.25;
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = '#ff8800';
  ctx.fillRect(px + inset2, py + inset2, ts - inset2 * 2, ts - inset2 * 2);
  const inset3 = ts * 0.38;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffcc';
  ctx.fillRect(px + inset3, py + inset3, ts - inset3 * 2, ts - inset3 * 2);
  ctx.globalAlpha = 1;
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, now: number, ts: number): void {
  if (!pu.revealed) return;
  const cx = pu.x * ts + ts / 2;
  const cy = pu.y * ts + ts / 2;
  const bounce = Math.sin(now * 0.004) * 2;
  const sc = ts / 48;
  ctx.fillStyle = 'rgba(255,255,100,0.15)';
  ctx.beginPath();
  ctx.arc(cx, cy + bounce, ts * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy + bounce);
  ctx.font = `bold ${Math.max(8, Math.floor(14 * sc))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  switch (pu.type) {
    case PowerUpType.BOMB_COUNT:
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(0, 0, 8 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('+', 0, -1);
      break;
    case PowerUpType.BOMB_RANGE:
      ctx.fillStyle = '#ff2200';
      ctx.beginPath();
      ctx.moveTo(0, -10 * sc);
      ctx.quadraticCurveTo(8 * sc, -4 * sc, 5 * sc, 4 * sc);
      ctx.quadraticCurveTo(0, 0, 0, 10 * sc);
      ctx.quadraticCurveTo(0, 0, -5 * sc, 4 * sc);
      ctx.quadraticCurveTo(-8 * sc, -4 * sc, 0, -10 * sc);
      ctx.fill();
      break;
    case PowerUpType.SPEED:
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(2 * sc, -10 * sc);
      ctx.lineTo(-4 * sc, -1 * sc);
      ctx.lineTo(0, -1 * sc);
      ctx.lineTo(-2 * sc, 10 * sc);
      ctx.lineTo(4 * sc, 1 * sc);
      ctx.lineTo(0, 1 * sc);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { w: canvasW, h: canvasH } = getCanvasSize(state);
  const barH = 32;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, canvasH, canvasW, barH);
  const fontSize = Math.max(9, Math.min(12, Math.floor(canvasW / state.players.length / 16)));
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'middle';
  const spacing = canvasW / state.players.length;
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    const x = spacing * i + 12;
    const y = canvasH + barH / 2;
    ctx.fillStyle = p.alive ? p.color : '#555555';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.alive ? '#ffffff' : '#666666';
    ctx.textAlign = 'left';
    const label = p.isBot ? `B${p.id}` : 'YOU';
    const stats = `${label} B:${p.maxBombs} R:${p.bombRange} S:${p.speed}`;
    ctx.fillText(stats, x + 10, y);
    if (!p.alive) {
      ctx.fillStyle = '#ff4444';
      ctx.fillText(' [X]', x + 10 + ctx.measureText(stats).width, y);
    }
  }
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
  if (cachedMapCanvas) {
    ctx.drawImage(cachedMapCanvas as CanvasImageSource, 0, 0);
  }
  for (const pu of state.powerUps) {
    drawPowerUp(ctx, pu, now, ts);
  }
  for (const bomb of state.bombs) {
    drawBomb(ctx, bomb, state.elapsed, ts);
  }
  for (const exp of state.explosions) {
    drawExplosion(ctx, exp, ts);
  }
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
  for (const player of players) {
    drawPlayer(ctx, player, now, ts);
  }
  drawHUD(ctx, state);
}

export function invalidateMapCache(): void {
  cachedMapCanvas = null;
  cachedMapVersion = -1;
  cachedTileSize = 0;
  cachedMapDims = '';
  mapVersion = 0;
}
