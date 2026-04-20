export enum MessageType {
    TEXT = "text",
    IMAGE = "image",
    FILE = "file",
    AUDIO = "audio",
    VIDEO = "video",
    CALL = "call",
    VOTE = 'vote',
    SYSTEM = 'system',
    MEDIA_ALBUM = "media_album",
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content?: string;
    type: MessageType;
    repliedToId?: string;
    repliedTold?: string;
    sentAt: Date | string;
    readBy?: string[];

    // Backend aliases
    _id?: string;
    parentMessageId?: string;
    status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | string;
    isDeletedForEveryone?: boolean;
    pinned?: boolean;
    pinnedAt?: Date | string | null;
    editedAt?: Date | string | null;
    metadata?: Record<string, unknown> | null;
    /** Tin album — từng phần tử có cdnUrl + mimeType */
    mediaItems?: Array<{
        cdnUrl: string;
        mimeType?: string;
        fileName?: string;
        fileSize?: number;
    }>;
    /** Backend: storyContext JSON (VD: callSessionId khi type CALL_LOG) */
    storyContext?: Record<string, unknown> | null;
    reactions?: Array<{ userId: string; emoji: string; reactedAt?: Date | string }>;
    visibility?: 'PUBLIC' | 'PRIVATE';
    visibleToUserIds?: string[];
}
