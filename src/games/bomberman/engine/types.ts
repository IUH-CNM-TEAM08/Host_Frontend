// ─── Boom V2 — Type Definitions ────────────────────────────────────────

export const TILE_SIZE = 48;
export const MAP_COLS = 15;
export const MAP_ROWS = 13;
export const BOMB_TIMER = 2000;
export const EXPLOSION_DURATION = 400;
export const BOT_TICK_MIN = 200;
export const BOT_TICK_MAX = 500;

export interface MapSizeDef {
  id: string;
  label: string;
  cols: number;
  rows: number;
  tileSize: number;
}

export const MAP_SIZES: MapSizeDef[] = [
  { id: 'small', label: 'Nhỏ', cols: 15, rows: 13, tileSize: 48 },
  { id: 'medium', label: 'Vừa', cols: 21, rows: 15, tileSize: 36 },
  { id: 'large', label: 'Lớn', cols: 27, rows: 19, tileSize: 28 },
];

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  BREAKABLE = 2,
}

export enum PowerUpType {
  BOMB_COUNT = 'bomb_count',
  BOMB_RANGE = 'bomb_range',
  SPEED = 'speed',
}

export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: number;
  characterIndex: number;
  x: number;
  y: number;
  alive: boolean;
  maxBombs: number;
  activeBombs: number;
  bombRange: number;
  speed: number;
  isBot: boolean;
  color: string;
  direction: Direction;
  visualX: number;
  visualY: number;
  moveProgress: number;
  moving: boolean;
}

export interface Bomb {
  x: number;
  y: number;
  ownerId: number;
  timer: number;
  range: number;
  placed: number;
}

export interface Explosion {
  x: number;
  y: number;
  timer: number;
}

export interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  revealed: boolean;
}

export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover';

export interface GameState {
  map: TileType[][];
  mapId: string;
  cols: number;
  rows: number;
  tileSize: number;
  players: Player[];
  bombs: Bomb[];
  explosions: Explosion[];
  powerUps: PowerUp[];
  status: GameStatus;
  winner: number | null;
  elapsed: number;
}

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#a855f7', '#22c55e', '#eab308', '#f97316'];

export interface CharacterDef {
  id: number;
  name: string;
  color: string;
  asset: string;
}

export const CHARACTERS: CharacterDef[] = [
  { id: 0, name: 'Bing', color: '#ef4444', asset: 'Boom-Mobile-NV-1.jpg' },
  { id: 1, name: 'Frost', color: '#3b82f6', asset: 'Boom-Mobile-NV-2.jpg' },
  { id: 2, name: 'Luna', color: '#a855f7', asset: 'Boom-Mobile-NV-3.jpg' },
  { id: 3, name: 'Bao', color: '#22c55e', asset: 'Boom-Mobile-NV-4.jpg' },
  { id: 4, name: 'Rex', color: '#eab308', asset: 'Boom-Mobile-NV-5.jpg' },
  { id: 5, name: 'Kiki', color: '#f97316', asset: 'Boom-Mobile-NV-6.jpg' },
];

export const DIRECTION_DELTA: Record<Direction, Position> = {
  [Direction.UP]: { x: 0, y: -1 },
  [Direction.DOWN]: { x: 0, y: 1 },
  [Direction.LEFT]: { x: -1, y: 0 },
  [Direction.RIGHT]: { x: 1, y: 0 },
};
