import { toast } from 'svelte-sonner';

const pendingMessages: string[] = [];
let notificationsReady = false;

export const notify = (message: string): void => {
  if (typeof window === 'undefined') return;
  if (!notificationsReady) {
    if (pendingMessages.at(-1) !== message) pendingMessages.push(message);
    if (pendingMessages.length > 10) pendingMessages.shift();
    return;
  }
  toast(message);
};

export const enableNotifications = (): void => {
  if (notificationsReady || typeof window === 'undefined') return;
  notificationsReady = true;
  for (const message of pendingMessages.splice(0)) toast(message);
};

export const prompt = (message: string): boolean => {
  return confirm(message);
};
