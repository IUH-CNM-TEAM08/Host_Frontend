import { get, post } from './http';

export const stickerService = {
  listPacks: <T = unknown>() => get<T>('/api/stickers/packs'),
  list: <T = unknown>(packId?: string) => get<T>('/api/stickers', packId ? { packId } : undefined),
  search: <T = unknown>(q: string) => get<T>('/api/stickers/search', { q }),
  createPack: <T = unknown>(body: Record<string, unknown>) => post<T>('/api/stickers/packs', body),
  createSticker: <T = unknown>(body: Record<string, unknown>) => post<T>('/api/stickers', body),
};
