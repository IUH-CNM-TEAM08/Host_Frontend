import {
  TileType,
  PowerUpType,
  MAP_SIZES,
  CHARACTERS,
  Direction,
  type Player,
  type PowerUp,
  type GameState,
} from './types';

export interface MapTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  generate: (cols: number, rows: number) => TileType[][];
}

function getSpawnZones(cols: number, rows: number): { x: number; y: number }[][] {
  return [
    [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
    [{ x: cols - 2, y: 1 }, { x: cols - 3, y: 1 }, { x: cols - 2, y: 2 }],
    [{ x: 1, y: rows - 2 }, { x: 2, y: rows - 2 }, { x: 1, y: rows - 3 }],
    [{ x: cols - 2, y: rows - 2 }, { x: cols - 3, y: rows - 2 }, { x: cols - 2, y: rows - 3 }],
  ];
}

function buildClearSet(cols: number, rows: number): Set<string> {
  const clearSet = new Set<string>();
  for (const zone of getSpawnZones(cols, rows)) {
    for (const pos of zone) {
      clearSet.add(`${pos.x},${pos.y}`);
    }
  }
  return clearSet;
}

function createBaseMap(usePillars: boolean, cols: number, rows: number): TileType[][] {
  const map: TileType[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: TileType[] = [];
    for (let col = 0; col < cols; col++) {
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
        line.push(TileType.WALL);
      } else if (usePillars && row % 2 === 0 && col % 2 === 0) {
        line.push(TileType.WALL);
      } else {
        line.push(TileType.EMPTY);
      }
    }
    map.push(line);
  }
  return map;
}

function fillBreakable(map: TileType[][], density: number, cols: number, rows: number): void {
  const clearSet = buildClearSet(cols, rows);
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      if (map[row][col] !== TileType.EMPTY) continue;
      if (clearSet.has(`${col},${row}`)) continue;
      if (Math.random() < density) map[row][col] = TileType.BREAKABLE;
    }
  }
}

function generateClassic(cols: number, rows: number): TileType[][] {
  const map = createBaseMap(true, cols, rows);
  fillBreakable(map, 0.4, cols, rows);
  return map;
}

function generateArena(cols: number, rows: number): TileType[][] {
  const map = createBaseMap(false, cols, rows);
  for (let row = 2; row < rows - 2; row++) {
    for (let col = 2; col < cols - 2; col++) {
      if (row === 2 || row === rows - 3 || col === 2 || col === cols - 3) {
        const midCol = Math.floor(cols / 2);
        const midRow = Math.floor(rows / 2);
        if (col === midCol || row === midRow) continue;
        map[row][col] = TileType.BREAKABLE;
      }
    }
  }
  for (let row = 4; row < rows - 4; row += 3) {
    for (let col = 4; col < cols - 4; col += 3) {
      map[row][col] = TileType.WALL;
    }
  }
  fillBreakable(map, 0.2, cols, rows);
  return map;
}

function generateMaze(cols: number, rows: number): TileType[][] {
  const map = createBaseMap(true, cols, rows);
  const clearSet = buildClearSet(cols, rows);
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      if (map[row][col] !== TileType.EMPTY) continue;
      if (clearSet.has(`${col},${row}`)) continue;
      if (row % 4 === 0 && col > 2 && col < cols - 3 && Math.random() < 0.5) {
        map[row][col] = TileType.WALL;
      }
    }
  }
  fillBreakable(map, 0.55, cols, rows);
  return map;
}

function generateCross(cols: number, rows: number): TileType[][] {
  const map = createBaseMap(false, cols, rows);
  const midCol = Math.floor(cols / 2);
  const midRow = Math.floor(rows / 2);
  const clearSet = buildClearSet(cols, rows);

  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      if (map[row][col] !== TileType.EMPTY) continue;
      if (clearSet.has(`${col},${row}`)) continue;
      map[row][col] = TileType.BREAKABLE;
    }
  }

  for (let col = 1; col < cols - 1; col++) {
    map[midRow][col] = TileType.EMPTY;
    if (midRow - 1 > 0) map[midRow - 1][col] = TileType.EMPTY;
  }
  for (let row = 1; row < rows - 1; row++) {
    map[row][midCol] = TileType.EMPTY;
    if (midCol - 1 > 0) map[row][midCol - 1] = TileType.EMPTY;
  }

  for (let i = 0; i < Math.min(midRow, midCol) - 1; i++) {
    const positions = [
      { r: 1 + i, c: 1 + i },
      { r: rows - 2 - i, c: cols - 2 - i },
      { r: 1 + i, c: cols - 2 - i },
      { r: rows - 2 - i, c: 1 + i },
    ];
    for (const { r, c } of positions) {
      if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
        map[r][c] = TileType.EMPTY;
      }
    }
  }

  for (let row = 3; row < rows - 3; row += 4) {
    for (let col = 3; col < cols - 3; col += 4) {
      if (row === midRow || col === midCol) continue;
      map[row][col] = TileType.WALL;
    }
  }
  return map;
}

function generateFortress(cols: number, rows: number): TileType[][] {
  const map = createBaseMap(false, cols, rows);
  const clearSet = buildClearSet(cols, rows);
  const rooms = [
    { r1: 2, c1: 2, r2: 5, c2: 5 },
    { r1: 2, c1: cols - 6, r2: 5, c2: cols - 3 },
    { r1: rows - 6, c1: 2, r2: rows - 3, c2: 5 },
    { r1: rows - 6, c1: cols - 6, r2: rows - 3, c2: cols - 3 },
  ];
  for (const room of rooms) {
    const r1 = Math.max(1, room.r1);
    const r2 = Math.min(rows - 2, room.r2);
    const c1 = Math.max(1, room.c1);
    const c2 = Math.min(cols - 2, room.c2);
    for (let row = r1; row <= r2; row++) {
      for (let col = c1; col <= c2; col++) {
        if (row === r1 || row === r2 || col === c1 || col === c2) {
          if (!clearSet.has(`${col},${row}`)) {
            map[row][col] = TileType.BREAKABLE;
          }
        }
      }
    }
  }
  const midR = Math.floor(rows / 2);
  const midC = Math.floor(cols / 2);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      map[midR + dr][midC + dc] = TileType.WALL;
    }
  }
  fillBreakable(map, 0.25, cols, rows);
  return map;
}

function generateDesert(cols: number, rows: number): TileType[][] {
  const map = createBaseMap(false, cols, rows);
  const clearSet = buildClearSet(cols, rows);
  const midC = Math.floor(cols / 2);
  const midR = Math.floor(rows / 2);

  const oasisCenters = [
    { r: midR, c: midC },
    { r: 3, c: Math.floor(cols * 0.3) },
    { r: rows - 4, c: Math.floor(cols * 0.7) },
  ];

  for (const oc of oasisCenters) {
    const spots = [
      { r: oc.r, c: oc.c },
      { r: oc.r - 1, c: oc.c },
      { r: oc.r + 1, c: oc.c },
      { r: oc.r, c: oc.c - 1 },
      { r: oc.r, c: oc.c + 1 },
    ];
    for (const s of spots) {
      if (s.r > 0 && s.r < rows - 1 && s.c > 0 && s.c < cols - 1) {
        if (!clearSet.has(`${s.c},${s.r}`)) map[s.r][s.c] = TileType.WALL;
      }
    }
  }

  for (let r = 3; r < rows - 3; r += 3) {
    for (let c = 3; c < cols - 3; c += 4) {
      if (map[r][c] !== TileType.EMPTY) continue;
      if (clearSet.has(`${c},${r}`)) continue;
      const tooClose = oasisCenters.some((oc) => Math.abs(oc.r - r) <= 1 && Math.abs(oc.c - c) <= 1);
      if (tooClose) continue;
      if (Math.random() < 0.45) map[r][c] = TileType.WALL;
    }
  }

  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (map[r][c] !== TileType.EMPTY) continue;
      if (clearSet.has(`${c},${r}`)) continue;
      const distToCenter = Math.abs(r - midR) + Math.abs(c - midC);
      const maxDist = midR + midC;
      const edgeFactor = distToCenter / maxDist;
      const density = 0.25 + edgeFactor * 0.25;
      if (Math.random() < density) map[r][c] = TileType.BREAKABLE;
    }
  }

  return map;
}

export const MAP_TEMPLATES: MapTemplate[] = [
  { id: 'classic', name: 'Classic', description: 'Standard grid with pillars', color: '#3b82f6', generate: generateClassic },
  { id: 'arena', name: 'Arena', description: 'Open center with ring walls', color: '#ef4444', generate: generateArena },
  { id: 'maze', name: 'Maze', description: 'Dense corridors and tight spaces', color: '#22c55e', generate: generateMaze },
  { id: 'cross', name: 'Cross', description: 'X-shaped paths from corners to center', color: '#a855f7', generate: generateCross },
  { id: 'fortress', name: 'Fortress', description: 'Four rooms connected by hallways', color: '#eab308', generate: generateFortress },
  { id: 'desert', name: 'Sa Mạc', description: 'Open dunes, oasis camps, cactus pillars', color: '#d97706', generate: generateDesert },
];

function getSpawnPositions(cols: number, rows: number) {
  return [
    { x: 1, y: 1 },
    { x: cols - 2, y: rows - 2 },
    { x: cols - 2, y: 1 },
    { x: 1, y: rows - 2 },
  ];
}

function generatePowerUps(map: TileType[][], cols: number, rows: number): PowerUp[] {
  const powerUps: PowerUp[] = [];
  const types = [PowerUpType.BOMB_COUNT, PowerUpType.BOMB_RANGE, PowerUpType.SPEED];
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      if (map[row][col] === TileType.BREAKABLE && Math.random() < 0.25) {
        powerUps.push({
          x: col,
          y: row,
          type: types[Math.floor(Math.random() * types.length)],
          revealed: false,
        });
      }
    }
  }
  return powerUps;
}

export function createGameState(botCount = 1, mapId?: string, characterId?: number, sizeId?: string): GameState {
  const template = MAP_TEMPLATES.find((t) => t.id === mapId) || MAP_TEMPLATES[0];
  const sizeDef = MAP_SIZES.find((s) => s.id === sizeId) || MAP_SIZES[0];
  const { cols, rows, tileSize } = sizeDef;

  const map = template.generate(cols, rows);
  const powerUps = generatePowerUps(map, cols, rows);
  const spawnPositions = getSpawnPositions(cols, rows);
  const humanCharIdx = characterId ?? 0;
  const availableBotChars = CHARACTERS.filter((c) => c.id !== humanCharIdx);
  for (let i = availableBotChars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableBotChars[i], availableBotChars[j]] = [availableBotChars[j], availableBotChars[i]];
  }

  const players: Player[] = [];
  for (let i = 0; i <= botCount; i++) {
    const spawn = spawnPositions[i];
    const charDef = i === 0 ? CHARACTERS[humanCharIdx] : availableBotChars[(i - 1) % availableBotChars.length];
    players.push({
      id: i,
      characterIndex: charDef.id,
      x: spawn.x,
      y: spawn.y,
      alive: true,
      maxBombs: 1,
      activeBombs: 0,
      bombRange: 1,
      speed: 1,
      isBot: i > 0,
      color: charDef.color,
      direction: Direction.DOWN,
      visualX: spawn.x,
      visualY: spawn.y,
      moveProgress: 1,
      moving: false,
    });
  }

  return {
    map,
    mapId: template.id,
    cols,
    rows,
    tileSize,
    players,
    bombs: [],
    explosions: [],
    powerUps,
    status: 'menu',
    winner: null,
    elapsed: 0,
  };
}
