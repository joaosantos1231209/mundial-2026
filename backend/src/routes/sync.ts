import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { syncAllSquads, syncLiveScores, syncMatchStats } from '../services/espnSync';
import db from '../db/index';
import { matches } from '../db/schema';

const router = Router();

// POST /api/sync/squads — busca os 26 jogadores de cada equipa da ESPN
router.post('/squads', async (_req, res) => {
  const messages: string[] = [];
  try {
    const result = await syncAllSquads(msg => messages.push(msg));
    res.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      log: messages,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, log: messages });
  }
});

// POST /api/sync/scores — atualiza resultados da ESPN
router.post('/scores', async (_req, res) => {
  try {
    const result = await syncLiveScores();
    res.json({
      success: true,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sync/stats/:matchId — força sync de estatísticas de um jogo
router.post('/stats/:matchId', async (req, res) => {
  const matchId = parseInt(req.params.matchId);
  let match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!match) return res.status(404).json({ success: false, error: 'Jogo não encontrado' });
  if (!match.espnEventId) return res.status(400).json({ success: false, error: 'Jogo sem ID ESPN — faz sync de resultados primeiro' });

  // Se ainda está Scheduled, forçar sync de resultados para atualizar status e marcador
  if (match.status === 'Scheduled') {
    await syncLiveScores().catch(() => {});
    match = (await db.query.matches.findFirst({ where: eq(matches.id, matchId) })) ?? match;
  }

  const result = await syncMatchStats(matchId, match.espnEventId);
  res.json({ success: !result.error, events: result.events, error: result.error, matchStatus: match.status });
});

export default router;
