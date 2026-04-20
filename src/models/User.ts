export interface User {
    // UI legacy fields
    id: string;
    name: string;
    email?: string | null;
    phone?: string;
    gender?: string;
    password?: string;
    avatarURL?: string;
    coverURL?: string;
    dob?: string;
    isOnline?: boolean;
    createdAt?: string;
    updatedAt?: string;

    // Backend-aligned aliases
    accountId?: string;
    displayName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    coverUrl?: string;
    dateOfBirth?: string;
    status?: string;
    isVerified?: boolean;
    lastSeenAt?: string;
    role?: string;
    accountStatus?: string;
}

const requiredFields: (keyof User)[] = [
    'id',
    'name'
];

export const isUserComplete = (user: Partial<User>): user is User => {
    return requiredFields.every((field) => !!user[field]);
}
