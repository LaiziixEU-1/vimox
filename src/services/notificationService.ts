import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(
  uid: string,
): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "VimoX",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF2D2D",
      });
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch (e) {
    console.log("Notifications non disponibles:", e);
    return null;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.log("Notification locale impossible:", e);
  }
}

export async function notifyNewMatch(partnerName?: string): Promise<void> {
  await sendLocalNotification(
    "🎯 Nouveau match !",
    partnerName
      ? `Tu es connecté avec ${partnerName}`
      : "Tu as trouvé un partenaire !",
    { type: "match" },
  );
}

export async function notifyNewMessage(
  senderName: string,
  message: string,
): Promise<void> {
  await sendLocalNotification(
    `💬 ${senderName}`,
    message.length > 50 ? message.slice(0, 50) + "..." : message,
    { type: "message" },
  );
}

export function subscribeToNotifications(
  onNotification: (notification: Notifications.Notification) => void,
): () => void {
  const sub = Notifications.addNotificationReceivedListener(onNotification);
  return () => sub.remove();
}

export function subscribeToNotificationTaps(
  onTap: (response: Notifications.NotificationResponse) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(onTap);
  return () => sub.remove();
}
