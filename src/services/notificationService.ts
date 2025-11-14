export type NotificationType = 'global' | 'user' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  audienceUserId?: string; // for type 'user'
  createdAt: string;
  createdByUserId?: string;
  readByUserIds?: string[];
}

const NOTIFS_KEY = 'singletrack_notifications';

export function getNotifications(): Notification[] {
  const raw = localStorage.getItem(NOTIFS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveNotifications(all: Notification[]) {
  localStorage.setItem(NOTIFS_KEY, JSON.stringify(all));
}

export function addNotification(n: Omit<Notification, 'id' | 'createdAt' | 'readByUserIds'>): Notification {
  const all = getNotifications();
  const notif: Notification = {
    ...n,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    createdAt: new Date().toISOString(),
    readByUserIds: [],
  };
  all.unshift(notif);
  saveNotifications(all);
  return notif;
}

export function addGlobalMessage(title: string, message: string, createdByUserId?: string) {
  return addNotification({ type: 'global', title, message, createdByUserId });
}

export function addUserMessage(userId: string, title: string, message: string, createdByUserId?: string) {
  return addNotification({ type: 'user', title, message, audienceUserId: userId, createdByUserId });
}

export function getUserNotifications(userId?: string): Notification[] {
  const all = getNotifications();
  if (!userId) return all.filter(n => n.type === 'global');
  return all.filter(n => n.type === 'global' || (n.type === 'user' && n.audienceUserId === userId));
}

export function markAsRead(notificationId: string, userId: string) {
  const all = getNotifications();
  const n = all.find(n => n.id === notificationId);
  if (!n) return;
  n.readByUserIds = Array.from(new Set([...(n.readByUserIds || []), userId]));
  saveNotifications(all);
}

export function getUnreadCount(userId?: string): number {
  const all = getUserNotifications(userId);
  if (!userId) {
    // For global context (no user), unread concept doesn't apply
    return 0;
  }
  return all.filter(n => !(n.readByUserIds || []).includes(userId)).length;
}

export function deleteNotification(notificationId: string) {
  const all = getNotifications();
  const filtered = all.filter(n => n.id !== notificationId);
  saveNotifications(filtered);
}
