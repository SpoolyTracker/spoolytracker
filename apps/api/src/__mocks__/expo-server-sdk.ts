export class Expo {
  chunkPushNotifications(messages: any[]) {
    return messages;
  }
  sendPushNotificationsAsync(chunks: any[]) {
    return Promise.resolve([]);
  }
}
export class ExpoPushMessage {}
export class ExpoPushTicket {}
