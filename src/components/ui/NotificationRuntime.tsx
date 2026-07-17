import { useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { Notification as SystemNotification, NotificationPreferences } from '../../types';
import { playNotificationSound, unlockNotificationSounds, NotificationSound } from '../../lib/notificationSounds';

interface Props {
  onNavigate: (link: string) => void;
}

function soundFor(notification: SystemNotification): NotificationSound {
  const type = notification.tipo.toLowerCase();
  if (type === 'whatsapp_assigned' || type === 'whatsapp_assigned_message') return 'whatsapp_assigned';
  if (type === 'whatsapp_general' || type === 'whatsapp_queue_message') return 'whatsapp_general';
  return 'ticket';
}

async function onceAcrossTabs(key: string, action: () => Promise<void> | void) {
  const storageKey = `portalmeta.notification.handled.${key}`;
  const claim = async () => {
    const now = Date.now();
    const previous = Number(localStorage.getItem(storageKey) || 0);
    if (now - previous < 60_000) return;
    localStorage.setItem(storageKey, String(now));
    window.setTimeout(() => localStorage.removeItem(storageKey), 120_000);
    await action();
  };
  const locks = (navigator as any).locks;
  if (locks?.request) {
    await locks.request(`portalmeta:${key}`, { ifAvailable: true }, async (lock: unknown) => {
      if (lock) await claim();
    });
    return;
  }
  await claim();
}

export function NotificationRuntime({ onNavigate }: Props) {
  const preferences = useRef<NotificationPreferences>({
    sounds_enabled: true,
    volume: 0.7,
    ticket_enabled: true,
    whatsapp_general_enabled: true,
    whatsapp_assigned_enabled: true,
    browser_enabled: false,
  });
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  useEffect(() => {
    let active = true;
    api.get<NotificationPreferences>('/notifications/preferences')
      .then((data) => { if (active) preferences.current = data; })
      .catch(() => undefined);

    const unlock = () => { void unlockNotificationSounds(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    const refreshPreferences = (event: Event) => {
      preferences.current = (event as CustomEvent<NotificationPreferences>).detail;
    };
    window.addEventListener('notificationPreferencesChanged', refreshPreferences);

    const socket = getSocket();
    const handleNotification = (notification: SystemNotification) => {
      window.dispatchEvent(new CustomEvent('portalmeta:notification', { detail: notification }));
      void onceAcrossTabs(String(notification.event_key || notification.id), async () => {
        const prefs = preferences.current;
        if (prefs.sounds_enabled) {
          await playNotificationSound(soundFor(notification), prefs.volume);
        }
        if (prefs.browser_enabled && 'Notification' in window && window.Notification.permission === 'granted') {
          const native = new window.Notification(notification.titulo, {
            body: notification.mensagem || undefined,
            icon: '/favicon.png',
            tag: String(notification.event_key || `notification-${notification.id}`),
          });
          native.onclick = () => {
            window.focus();
            if (notification.link) navigateRef.current(notification.link);
            native.close();
          };
        }
      });
    };
    socket.on('notificationCreated', handleNotification);
    return () => {
      active = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('notificationPreferencesChanged', refreshPreferences);
      socket.off('notificationCreated', handleNotification);
    };
  }, []);

  return null;
}
