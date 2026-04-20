export interface PostAuthor {
  id: string;
  name: string;
  avatarURL?: string;
}

export interface PostMedia {
  url: string;
  type: 'image' | 'video' | 'text' | 'IMAGE' | 'VIDEO' | 'TEXT';
}

export interface Post {
  id: string;
  author: PostAuthor;
  content?: string;
  emotion?: string;
  media?: PostMedia[];
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  reactionCounts?: Record<string, number>;
  userReaction?: string | null;
  createdAt?: string;
  updatedAt?: string;
  privacy?: 'public' | 'friends' | 'private' | 'PUBLIC' | 'FRIENDS' | 'PRIVATE';

  // Backend aliases
  _id?: string;
  authorId?: string;
  visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  mediaList?: Array<{ url: string; type: 'IMAGE' | 'VIDEO' | 'TEXT'; order?: number }>;
  isDeleted?: boolean;
}

export interface Story {
  id: string;
  author: PostAuthor;
  mediaURL?: string;
  mediaType: 'image' | 'video' | 'text' | 'IMAGE' | 'VIDEO' | 'TEXT';
  caption?: string;
  viewed?: boolean;
  createdAt?: string;
  expiresAt?: string;
  visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';

  // Backend aliases
  _id?: string;
  authorId?: string;
  mediaUrl?: string;
  type?: 'IMAGE' | 'VIDEO' | 'TEXT';
  viewCount?: number;
}
