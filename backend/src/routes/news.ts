import { Router } from 'express';
import { desc } from 'drizzle-orm';
import db from '../db/index';
import { news } from '../db/schema';
import { syncNews } from '../services/newsSync';

const router = Router();

// GET /api/news
router.get('/', async (_req, res) => {
  const articles = await db.select().from(news).orderBy(desc(news.publishedAt)).limit(50);
  res.json(articles);
});

// POST /api/news/sync — forçar sync manual
router.post('/sync', async (_req, res) => {
  const result = await syncNews();
  res.json({ success: true, added: result.added, errors: result.errors });
});

export default router;
