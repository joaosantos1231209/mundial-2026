import { Router } from 'express';
import { eq } from 'drizzle-orm';
import db from '../db/index';
import { pushSubscriptions } from '../db/schema';
import { sendNotification } from '../services/pushService';

const router = Router();

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
  res.json({ publicKey: key });
});

// POST /api/push/subscribe
router.post('/subscribe', async (req, res) => {
  const { endpoint, p256dh, auth } = req.body;
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'endpoint, p256dh e auth são obrigatórios' });

  try {
    // Upsert: if endpoint already exists, update keys
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    if (existing.length > 0) {
      await db.update(pushSubscriptions).set({ p256dh, auth }).where(eq(pushSubscriptions.endpoint, endpoint));
    } else {
      await db.insert(pushSubscriptions).values({
        endpoint, p256dh, auth, createdAt: new Date().toISOString(),
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint é obrigatório' });
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  res.json({ success: true });
});

// POST /api/push/test — sends a test notification to all subscribers
router.post('/test', async (_req, res) => {
  await sendNotification('Mundial 2026 🏆', 'Notificações ativas! Vais receber alertas dos jogos.', '/');
  res.json({ success: true });
});

export default router;
