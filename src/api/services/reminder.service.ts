import { del, get, post, put } from './http';

export const reminderService = {
  create: <T = unknown>(body: Record<string, unknown>) => post<T>('/api/reminders', body),
  getByConversation: <T = unknown>(conversationId: string, userId: string) =>
    get<T>(`/api/reminders/conversation/${encodeURIComponent(conversationId)}`, { userId }),
  update: <T = unknown>(reminderId: string, body: Record<string, unknown>) =>
    put<T>(`/api/reminders/${encodeURIComponent(reminderId)}`, body),
  delete: (reminderId: string) => del(`/api/reminders/${encodeURIComponent(reminderId)}`),
};
