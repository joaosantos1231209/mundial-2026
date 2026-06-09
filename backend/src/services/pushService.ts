import webpush from 'web-push';
import db from '../db/index';
import { pushSubscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';

let initialised = false;

function init() {
  if (initialised) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mundial2026.app';
  if (!pub || !priv) return;
  webpush.setVapidDetails(subject, pub, priv);
  initialised = true;
}

export async function sendNotification(title: string, body: string, url = '/') {
  init();
  if (!initialised) return;

  const subs = await db.select().from(pushSubscriptions);
  const payload = JSON.stringify({ title, body, url });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err: any) {
      // 410 Gone = subscription expired / revoked → remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
      }
    }
  }
}
