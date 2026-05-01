import { Conversation, ParticipantInfo } from '@/src/models/Conversation';
import FriendRequest from '@/src/models/FriendRequest';
import { Message, MessageType } from '@/src/models/Message';
import { Post, Story } from '@/src/models/Post';
import { User } from '@/src/models/User';

const toIso = (value: unknown): string => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
};

const toLowerPrivacy = (value: unknown): 'public' | 'friends' | 'private' => {
  const v = String(value || 'PUBLIC').toUpperCase();
  if (v === 'FRIENDS') return 'friends';
  if (v === 'PRIVATE') return 'private';
  return 'public';
};

/** Chuẩn hoá role participant (API có thể trả MEMBER / moderator / MODERATOR, v.v.) */
export const mapParticipantRoleToModel = (rawRole: unknown): ParticipantInfo['role'] => {
  const rawRoleStr = String(rawRole || 'member').toUpperCase();
  if (rawRoleStr === 'OWNER') return 'owner';
  if (rawRoleStr === 'ADMIN') return 'admin';
  if (rawRoleStr === 'MODERATOR' || rawRoleStr === 'MOD') return 'moderator';
  return 'member';
};

export const normalizeMessageType = (value: unknown): MessageType => {
  const v = String(value || '').toUpperCase();
  switch (v) {
    case 'IMAGE':
      return MessageType.IMAGE;
    case 'FILE':
      return MessageType.FILE;
    case 'AUDIO':
      return MessageType.AUDIO;
    case 'VIDEO':
      return MessageType.VIDEO;
    case 'CALL':
    case 'CALL_LOG':
      return MessageType.CALL;
    case 'VOTE':
      return MessageType.VOTE;
    case 'MEDIA_ALBUM':
      return MessageType.MEDIA_ALBUM;
    case 'SYSTEM':
    case 'REMINDER_DUE':
      return MessageType.SYSTEM;
    case 'TEXT':
    default:
      return MessageType.TEXT;
  }
};

export const mapApiUserToUser = (raw: any): User => {
  const id = raw?.id ?? raw?._id ?? '';
  const name = raw?.name ?? raw?.displayName ?? '';
  const avatar = raw?.avatarURL ?? raw?.avatarUrl ?? '';
  const cover = raw?.coverURL ?? raw?.coverUrl ?? '';
  const phone = raw?.phone ?? raw?.phoneNumber ?? '';
  const dob = raw?.dob ?? raw?.dateOfBirth ? toIso(raw?.dob ?? raw?.dateOfBirth) : '';

  return {
    id,
    name,
    email: raw?.email ?? null,
    phone,
    gender: raw?.gender,
    avatarURL: avatar,
    coverURL: cover,
    dob,
    isOnline: raw?.isOnline ?? raw?.status === 'ONLINE',
    createdAt: raw?.createdAt ? toIso(raw.createdAt) : undefined,
    updatedAt: raw?.updatedAt ? toIso(raw.updatedAt) : undefined,

    accountId: raw?.accountId,
    displayName: raw?.displayName,
    phoneNumber: raw?.phoneNumber,
    avatarUrl: raw?.avatarUrl,
    coverUrl: raw?.coverUrl,
    dateOfBirth: raw?.dateOfBirth ? toIso(raw.dateOfBirth) : undefined,
    status: raw?.status,
    isVerified: raw?.isVerified,
    lastSeenAt: raw?.lastSeenAt
      ? toIso(raw.lastSeenAt)
      : raw?.lastSeen
        ? toIso(raw.lastSeen)
        : undefined,
    role: raw?.role,
    accountStatus: raw?.accountStatus,
  };
};

export const mapApiFriendRequestToModel = (raw: any): FriendRequest => {
  const statusMap: Record<string, FriendRequest['status']> = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'declined',
    RECALLED: 'recalled',
    BLOCKED: 'blocked',
  };

  const normalizedStatus = statusMap[String(raw?.status || '').toUpperCase()] || (raw?.status ?? 'pending');

  return {
    id: raw?.id ?? raw?._id ?? '',
    senderId: raw?.senderId ?? raw?.requesterId ?? '',
    receiverId: raw?.receiverId ?? raw?.targetId ?? '',
    status: normalizedStatus,
    createAt: raw?.createAt ?? raw?.createdAt ?? toIso(new Date()),
    updateAt: raw?.updateAt ?? raw?.updatedAt ?? toIso(new Date()),

    requesterId: raw?.requesterId,
    targetId: raw?.targetId,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
};

export const mapApiMessageToModel = (raw: any): Message => ({
  id: raw?.id ?? raw?._id ?? '',
  _id: raw?._id,
  conversationId: raw?.conversationId ?? '',
  senderId: raw?.senderId ?? '',
  content: raw?.content ?? '',
  type: normalizeMessageType(raw?.type),
  repliedToId: raw?.repliedToId ?? raw?.parentMessageId ?? undefined,
  parentMessageId: raw?.parentMessageId,
  sentAt: toIso(raw?.sentAt ?? raw?.createdAt),
  readBy: Array.isArray(raw?.readBy) ? raw.readBy : [],
  status: raw?.status,
  isDeletedForEveryone: raw?.isDeletedForEveryone,
  pinned: raw?.pinned,
  pinnedAt: raw?.pinnedAt ? toIso(raw.pinnedAt) : raw?.pinnedAt,
  editedAt: raw?.editedAt ? toIso(raw.editedAt) : raw?.editedAt,
  metadata: raw?.metadata,
  mediaItems: Array.isArray(raw?.mediaItems)
    ? raw.mediaItems.map((x: any) => ({
        cdnUrl: String(x?.cdnUrl ?? x?.url ?? ''),
        mimeType: x?.mimeType != null ? String(x.mimeType) : undefined,
        fileName: x?.fileName != null ? String(x.fileName) : undefined,
        fileSize: typeof x?.fileSize === 'number' ? x.fileSize : undefined,
      }))
    : undefined,
  storyContext: raw?.storyContext ?? undefined,
  reactions: raw?.reactions,
});

export const mapApiConversationToModel = (raw: any): Conversation => {
  const type = String(raw?.type || '').toUpperCase();
  const isGroup = raw?.isGroup ?? type === 'GROUP';

  const participantIds: string[] = Array.isArray(raw?.participantIds)
    ? raw.participantIds
    : Array.isArray(raw?.participants)
      ? raw.participants.map((p: any) => p?.userId ?? p?.id).filter(Boolean)
      : [];

  const participantInfo: ParticipantInfo[] = Array.isArray(raw?.participantInfo)
    ? raw.participantInfo.map((p: any) => ({
        id: String(p?.userId ?? p?.id ?? ''),
        name: p?.name ?? p?.displayName ?? '',
        avatar: p?.avatar ?? p?.avatarUrl,
        nickname: p?.nickname ?? p?.peerNickname,
        role: mapParticipantRoleToModel(p?.role),
      }))
    : Array.isArray(raw?.participants)
      ? raw.participants.map((p: any) => ({
          id: String(p?.userId ?? p?.id ?? ''),
          name: p?.name ?? p?.displayName ?? '',
          avatar: p?.avatar ?? p?.avatarUrl,
          nickname: p?.nickname ?? p?.peerNickname,
          isOnline: p?.isOnline ?? false,
          role: mapParticipantRoleToModel(p?.role),
        }))
      : [];

  const pinMessages = Array.isArray(raw?.pinMessages)
    ? raw.pinMessages.map(mapApiMessageToModel)
    : Array.isArray(raw?.pinnedMessages)
      ? raw.pinnedMessages.map(mapApiMessageToModel)
      : [];

  const mappedType: Conversation['type'] = isGroup ? 'group' : '1vs1';

  return {
    id: raw?.id ?? raw?._id ?? '',
    _id: raw?._id,
    isGroup,
    name: raw?.name ?? '',
    avatarUrl: raw?.avatarUrl ?? raw?.avatarURL,
    avatarGroup: raw?.avatarGroup,
    type: mappedType,
    participantIds,
    participantInfo,
    url: raw?.url,
    pinMessages,
    settings: raw?.settings,
    lastMessage: raw?.lastMessage ? mapApiMessageToModel(raw.lastMessage) : null,
    createdAt: toIso(raw?.createdAt),
    updatedAt: raw?.updatedAt ? toIso(raw.updatedAt) : undefined,
    description: raw?.description,
    wallpaperUrl: raw?.wallpaperUrl,
    chatBackgroundId: raw?.chatBackgroundId ?? raw?.backgroundId,
    pinned: raw?.pinned,
    pinnedAt: raw?.pinnedAt ? toIso(raw.pinnedAt) : raw?.pinnedAt,
    aiEnabled: typeof raw?.aiEnabled === 'boolean' ? raw.aiEnabled : undefined,
  };
};

export const mapApiPostToModel = (raw: any): Post => {
  const id = raw?.id ?? raw?._id ?? '';
  const mediaFromList = Array.isArray(raw?.mediaList)
    ? raw.mediaList.map((m: any) => ({ url: m.url, type: String(m.type || 'IMAGE').toLowerCase() as 'image' | 'video' | 'text' }))
    : [];
  const mediaFromMedia = Array.isArray(raw?.media)
    ? raw.media
    : [];
  const media = mediaFromMedia.length > 0 ? mediaFromMedia : mediaFromList;

  const reactionCounts = raw?.reactionCounts ?? (Array.isArray(raw?.reactions)
    ? raw.reactions.reduce((acc: Record<string, number>, r: any) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + 1 }), {})
    : {});

  return {
    id,
    _id: raw?._id,
    authorId: raw?.authorId,
    author: {
      id: raw?.author?.id ?? raw?.authorId ?? '',
      name: raw?.author?.name ?? raw?.authorName ?? '',
      avatarURL: raw?.author?.avatarURL ?? raw?.author?.avatarUrl,
    },
    content: raw?.content,
    emotion: raw?.emotion,
    media,
    likeCount: raw?.likeCount ?? reactionCounts['LIKE'] ?? 0,
    commentCount: raw?.commentCount ?? 0,
    isLiked: raw?.isLiked ?? raw?.userReaction === 'LIKE' ?? false,
    reactionCounts,
    userReaction: raw?.userReaction ?? null,
    createdAt: raw?.createdAt ? toIso(raw.createdAt) : undefined,
    updatedAt: raw?.updatedAt ? toIso(raw.updatedAt) : undefined,
    privacy: toLowerPrivacy(raw?.privacy ?? raw?.visibility),
    visibility: raw?.visibility,
    mediaList: raw?.mediaList,
    isDeleted: raw?.isDeleted,
  };
};

export const mapApiStoryToModel = (raw: any): Story => ({
  id: raw?.id ?? raw?._id ?? '',
  _id: raw?._id,
  authorId: raw?.authorId,
  author: {
    id: raw?.author?.id ?? raw?.author?._id ?? raw?.authorId ?? '',
    name: raw?.author?.name ?? raw?.author?.displayName ?? raw?.authorName ?? '',
    avatarURL: raw?.author?.avatarURL ?? raw?.author?.avatarUrl,
  },
  mediaURL: raw?.mediaURL ?? raw?.mediaUrl,
  mediaType: (raw?.mediaType ?? raw?.type ?? 'IMAGE') as Story['mediaType'],
  caption: raw?.caption,
  viewed: !!raw?.viewed,
  createdAt: raw?.createdAt ? toIso(raw.createdAt) : undefined,
  expiresAt: raw?.expiresAt ? toIso(raw.expiresAt) : undefined,
  mediaUrl: raw?.mediaUrl,
  type: raw?.type,
  viewCount: raw?.viewCount,
});

export const unwrapData = <T = unknown>(payload: any): T => (payload?.data ?? payload) as T;

export const unwrapArray = <T = unknown>(payload: any): T[] => {
  const data = unwrapData<any>(payload);
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(payload?.items)) return payload.items as T[];
  return [];
};
