// Optional daily training reminder (a local notification; no server involved).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const ID = 1001;

export const remindersSupported = () => Capacitor.isNativePlatform();

/** Schedules (or cancels) the daily reminder. Returns false if permission was denied. */
export async function applyReminder(enabled: boolean, time: string): Promise<boolean> {
  if (!remindersSupported()) return true;
  await LocalNotifications.cancel({ notifications: [{ id: ID }] }).catch(() => undefined);
  if (!enabled) return true;
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  const [hour, minute] = time.split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: ID,
        title: 'Chess Coach',
        body: 'Your daily training is ready — 10 minutes keeps the streak alive! 🔥',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  });
  return true;
}
