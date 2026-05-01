import { Message } from '@/src/models/Message';

export interface ParticipantInfo {
    id: string;
    name: string;
    displayName?: string;
    avatar?: string;
    nickname?: string;
    role: 'member' | 'admin' | 'mod' | 'owner' | 'moderator';
}

export interface PendingUser {
    id: string;
    name?: string;
    avatar?: string;
    requestedAt?: Date | string;
}

export interface Settings {
    isReviewNewParticipant: boolean;
    isAllowReadNewMessage: boolean;
    isAllowMessaging: boolean;
    isAllowMemberChangeMetadata: boolean;
    isAllowMemberPin: boolean;
    isAllowMemberCreateNote: boolean;
    isAllowMemberCreatePoll: boolean;
    isAllowModManage: boolean;
    pendingList: PendingUser[];
}

export interface Conversation {
    id: string;
    isGroup: boolean;
    name: string;
    avatarUrl?: string;
    avatarGroup?: string;
    type: '1vs1' | 'group' | 'PRIVATE' | 'GROUP';
    participantIds: string[];
    participantInfo: ParticipantInfo[];
    url?: string;
    pinMessages: Message[];
    settings?: Settings;
    lastMessage?: Message | null;
    createdAt: Date | string;
    updatedAt?: Date | string;

    // Backend aliases
    _id?: string;
    description?: string;
    wallpaperUrl?: string;
    chatBackgroundId?: string;
    pinned?: boolean;
    pinnedAt?: Date | string | null;
    aiEnabled?: boolean;
    /** FE local state: mở tạm từ hidden search, chưa unhide vào inbox */
    isHiddenSession?: boolean;
}
