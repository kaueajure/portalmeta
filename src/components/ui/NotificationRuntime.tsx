import { useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import {
  NotificationSound,
  playNotificationSound,
  unlockNotificationSounds,
} from "../../lib/notificationSounds";
import { Notification as AppNotification, NotificationPreferences } from "../../types";

interface NotificationRuntimeProps {
  onNavigate: (link: string) => void;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  sounds_enabled: true,
  volume: 0.7,
  ticket_enabled: true,
  whatsapp_general_enabled: true,
  whatsapp_assigned_enabled: true,
  browser_enabled: false,
};

function getCategory(notification: AppNotification): NotificationSound | null {
  const category = String(notification.metadata?.category || "");
  if (
    category === "ticket" ||
    category === "whatsapp_general" ||
    category === "whatsapp_assigned"
  ) {
    return category;
  }

  const tipo = notification.tipo.toLowerCase();
  if (tipo.includes("whatsapp_assigned")) return "whatsapp_assigned";
  if (tipo.includes("whatsapp")) return "whatsapp_general";
  if (tipo.includes("ticket")) return "ticket";
  return null;
}

function isCategoryEnabled(
  prefs: NotificationPreferences,
  category: NotificationSound,
): boolean {
  if (category === "ticket") return prefs.ticket_enabled;
  if (category === "whatsapp_general") return prefs.whatsapp_general_enabled;
  return prefs.whatsapp_assigned_enabled;
}

function shouldShowBrowserNotification(): boolean {
  return document.hidden || !document.hasFocus();
}

export const NotificationRuntime = ({
  onNavigate,
}: NotificationRuntimeProps) => {
  const prefsRef = useRef<NotificationPreferences>(DEFAULT_PREFERENCES);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    let cancelled = false;

    api
      .get<NotificationPreferences>("/notifications/preferences")
      .then((prefs) => {
        if (!cancelled) prefsRef.current = prefs;
      })
      .catch(() => undefined);

    const onPrefsChanged = (event: Event) => {
      const detail = (event as CustomEvent<NotificationPreferences>).detail;
      if (detail) prefsRef.current = detail;
    };

    const unlockSounds = () => {
      void unlockNotificationSounds();
    };

    window.addEventListener("notificationPreferencesChanged", onPrefsChanged);
    window.addEventListener("pointerdown", unlockSounds, { once: true });

    const socket = getSocket();

    const handleCreated = (notification: AppNotification) => {
      if (!notification?.id) return;

      const prefs = prefsRef.current;
      const category = getCategory(notification);
      if (!category || !isCategoryEnabled(prefs, category)) return;

      window.dispatchEvent(
        new CustomEvent("portalmeta:notification", { detail: notification }),
      );

      if (prefs.sounds_enabled) {
        void playNotificationSound(category, prefs.volume);
      }

      if (
        prefs.browser_enabled &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        shouldShowBrowserNotification()
      ) {
        const desktop = new Notification(notification.titulo, {
          body: notification.mensagem || undefined,
          icon: "/favicon.png",
          tag: `portalmeta-${notification.id}`,
        });

        desktop.onclick = () => {
          window.focus();
          desktop.close();
          if (notification.link) {
            onNavigateRef.current(notification.link);
          }
        };
      }
    };

    socket.on("notificationCreated", handleCreated);

    return () => {
      cancelled = true;
      window.removeEventListener(
        "notificationPreferencesChanged",
        onPrefsChanged,
      );
      socket.off("notificationCreated", handleCreated);
    };
  }, []);

  return null;
};
