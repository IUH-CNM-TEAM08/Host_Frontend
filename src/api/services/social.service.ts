import { del, get, post, put } from './http';
import { mapApiPostToModel, mapApiStoryToModel, unwrapArray, unwrapData } from '@/src/models/mappers';

export const postService = {
  create: async <T = unknown>(body: Record<string, unknown>) => {
    const res: any = await post<any>('/api/posts', body);
    const raw = unwrapData<any>(res);
    const mapped = mapApiPostToModel(raw ?? res);
    if (res?.success !== undefined) {
      return { ...res, data: mapped } as T;
    }
    return ({ data: mapped } as unknown) as T;
  },
  list: async <T = unknown>(page?: number, size?: number) => {
    const res: any = await get<any>('/api/posts', { page, size });
    const items = unwrapArray<any>(res).map(mapApiPostToModel);
    if (res?.success !== undefined) {
      return { ...res, data: items } as T;
    }
    return ({ data: items } as unknown) as T;
  },
  getById: <T = unknown>(postId: string) => get<T>(`/api/posts/${encodeURIComponent(postId)}`),
  getByUser: <T = unknown>(userId: string) => get<T>(`/api/posts/user/${encodeURIComponent(userId)}`),
  update: <T = unknown>(postId: string, body: Record<string, unknown>) =>
    put<T>(`/api/posts/${encodeURIComponent(postId)}`, body),
  delete: (postId: string) => del(`/api/posts/${encodeURIComponent(postId)}`),
  like: <T = unknown>(postId: string) => post<T>(`/api/posts/${encodeURIComponent(postId)}/like`),
  react: <T = unknown>(postId: string, type: string) =>
    post<T>(`/api/posts/${encodeURIComponent(postId)}/reaction`, { type }),
  report: <T = unknown>(postId: string, reason: string) =>
    post<T>(`/api/posts/${encodeURIComponent(postId)}/report`, { reason }),
};

export const commentService = {
  create: <T = unknown>(body: Record<string, unknown>) => post<T>('/api/comments', body),
  listByPost: <T = unknown>(postId: string) => get<T>(`/api/comments/post/${encodeURIComponent(postId)}`),
  update: <T = unknown>(commentId: string, content: string) =>
    put<T>(`/api/comments/${encodeURIComponent(commentId)}`, { content }),
  delete: (commentId: string) => del(`/api/comments/${encodeURIComponent(commentId)}`),
};

export const storyService = {
  create: async <T = unknown>(body: Record<string, unknown>) => {
    const res: any = await post<T>('/api/stories', body);
    const item = mapApiStoryToModel(res?.data ?? res);
    if (res?.data) return { ...res, data: item } as T;
    return item as unknown as T;
  },
  listFriends: async <T = unknown>() => {
    const res: any = await get<any>('/api/stories/friends');
    const items = unwrapArray<any>(res).map(mapApiStoryToModel);
    if (res?.success !== undefined) {
      return { ...res, data: items } as T;
    }
    return ({ data: items } as unknown) as T;
  },
  view: <T = unknown>(storyId: string) => post<T>(`/api/stories/${encodeURIComponent(storyId)}/view`),
  viewers: <T = unknown>(storyId: string) => get<T>(`/api/stories/${encodeURIComponent(storyId)}/viewers`),
  delete: (storyId: string) => del(`/api/stories/${encodeURIComponent(storyId)}`),
};

export const feedFilterService = {
  hideAuthor: (hiddenUserId: string) => post('/api/feed/hidden-authors', { hiddenUserId }),
  unhideAuthor: (hiddenUserId: string) => del(`/api/feed/hidden-authors/${encodeURIComponent(hiddenUserId)}`),
  listHiddenAuthors: <T = unknown>() => get<T>('/api/feed/hidden-authors'),

  blockViewer: (blockedUserId: string) => post('/api/feed/author-blocks', { blockedUserId }),
  unblockViewer: (blockedUserId: string) => del(`/api/feed/author-blocks/${encodeURIComponent(blockedUserId)}`),
  listBlockedViewers: <T = unknown>() => get<T>('/api/feed/author-blocks'),
};

export const musicService = {
  search: <T = unknown>(query: string) => get<T>('/api/music/search', { query }),
  listAll: <T = unknown>() => get<T>('/api/music/all'),
};
