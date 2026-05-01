import { del, get, post } from './http';
import { mapApiFriendRequestToModel, unwrapArray, unwrapData } from '@/src/models/mappers';

export const friendshipService = {
  sendRequest: <T = unknown>(targetId: string, message?: string) => post<T>('/friends/requests', { targetId, message }),
  accept: <T = unknown>(friendshipId: string) => post<T>(`/friends/${encodeURIComponent(friendshipId)}/accept`),
  reject: (friendshipId: string) => del(`/friends/${encodeURIComponent(friendshipId)}/reject`),
  recall: (friendshipId: string) => del(`/friends/${encodeURIComponent(friendshipId)}/recall`),
  unfriend: (friendshipId: string) => del(`/friends/${encodeURIComponent(friendshipId)}`),

  listIncomingPending: <T = unknown>() => get<T>('/friends/pending/incoming'),
  listOutgoingPending: <T = unknown>() => get<T>('/friends/pending/outgoing'),
  listAccepted: <T = unknown>() => get<T>('/friends/accepted'),

  checkFriend: <T = unknown>(targetUserId: string) => get<T>('/friends/check', { targetUserId }),
  getStatus: <T = unknown>(targetUserId: string) => get<T>('/friends/status', { targetUserId }),
  searchUsers: <T = unknown>(keyword: string, excludeFriendIds?: string[]) =>
    get<T>('/friends/search', { keyword, excludeFriendIds }),
  getAllFriendsOfUser: <T = unknown>(userId: string) => get<T>(`/friends/user/${encodeURIComponent(userId)}/all-friends`),

  // Legacy adapters (for older FE components)
  getAllPendingFriendRequests: async (_userId?: string) => {
    const res: any = await friendshipService.listIncomingPending<any>();
    const friendRequests = unwrapArray<any>(res).map(mapApiFriendRequestToModel);
    return { success: res?.success ?? true, message: res?.message, friendRequests };
  },

  getAllPendingFriendRequestsBySenderId: async () => {
    const res: any = await friendshipService.listOutgoingPending<any>();
    const friendRequests = unwrapArray<any>(res).map(mapApiFriendRequestToModel);
    return { success: res?.success ?? true, message: res?.message, friendRequests };
  },

  getAllAcceptedFriendRequests: async (_userId?: string) => {
    const res: any = await friendshipService.listAccepted<any>();
    const friendRequests = unwrapArray<any>(res).map(mapApiFriendRequestToModel);
    return { success: res?.success ?? true, message: res?.message, friendRequests };
  },

  createFriendRequest: async (payload: { senderId?: string; receiverId: string; message?: string }) => {
    const res: any = await friendshipService.sendRequest<any>(payload.receiverId, payload.message);
    const mapped = mapApiFriendRequestToModel(unwrapData<any>(res));
    return {
      success: res?.success ?? true,
      message: res?.message,
      friendRequest: {
        _doc: {
          id: mapped.id,
          senderId: mapped.senderId,
          receiverId: mapped.receiverId,
          status: mapped.status,
          createAt: mapped.createAt,
          updateAt: mapped.updateAt,
        },
      },
    };
  },

  acceptFriendRequest: async (requestId: string) => {
    const res: any = await friendshipService.accept<any>(requestId);
    return { success: res?.success ?? true, message: res?.message, data: unwrapData<any>(res) };
  },

  declineFriendRequest: async (requestId: string) => {
    const res: any = await friendshipService.reject(requestId);
    return { success: res?.success ?? true, message: res?.message, data: unwrapData<any>(res) };
  },

  deleteFriendRequest: async (requestId: string) => {
    const res: any = await friendshipService.recall(requestId);
    return { success: res?.success ?? true, message: res?.message, data: unwrapData<any>(res) };
  },
};
