import { Router } from 'express';
import { desc } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import db from '../db/index';
import { scraperLogs } from '../db/schema';

const router = Router();

// GET /api/health-logs — últimas 30 execuções do scraper
router.get('/logs', async (_req, res) => {
  const logs = await db.select().from(scraperLogs).orderBy(desc(scraperLogs.runAt)).limit(30);
  res.json(logs);
});

// GET /api/health/backup — download do ficheiro .db
router.get('/backup', (_req, res) => {
  const dbFile = path.join(process.cwd(), 'mundial.db');
  if (!fs.existsSync(dbFile)) {
    return res.status(404).json({ error: 'Ficheiro de base de dados não encontrado' });
  }
  const date = new Date().toISOString().split('T')[0];
  res.download(dbFile, `mundial_backup_${date}.db`);
});

export default router;
