interface FriendRequest {
    id: string;
    senderId: string;
    receiverId: string;
    status: 'pending' | 'accepted' | 'declined' | 'recalled' | 'blocked' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'RECALLED' | 'BLOCKED';
    createAt: Date | string;
    updateAt: Date | string;

    // Backend aliases
    requesterId?: string;
    targetId?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export default FriendRequest;

