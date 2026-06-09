import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../db/index';
import { lineups } from '../db/schema';

const router = Router();

// GET /api/lineups/:matchId/:teamId
router.get('/:matchId/:teamId', async (req, res) => {
  const matchId = Number(req.params.matchId);
  const teamId = Number(req.params.teamId);
  const result = await db.query.lineups.findMany({
    where: and(eq(lineups.matchId, matchId), eq(lineups.teamId, teamId)),
    with: { player: true },
  });
  res.json(result);
});

// POST /api/lineups — save full lineup (replaces existing)
router.post('/', async (req, res) => {
  const { matchId, teamId, players: playerList } = req.body;
  if (!matchId || !teamId || !Array.isArray(playerList)) {
    return res.status(400).json({ error: 'matchId, teamId e players[] são obrigatórios' });
  }
  // Delete existing lineup for this match+team
  await db.delete(lineups).where(and(eq(lineups.matchId, Number(matchId)), eq(lineups.teamId, Number(teamId))));
  // Insert new lineup
  if (playerList.length > 0) {
    await db.insert(lineups).values(
      playerList.map((p: { playerId: number; posX: number; posY: number; isStarter?: boolean }) => ({
        matchId: Number(matchId),
        teamId: Number(teamId),
        playerId: Number(p.playerId),
        posX: Math.round(p.posX),
        posY: Math.round(p.posY),
        isStarter: p.isStarter ? 1 : 0,
      }))
    );
  }
  const saved = await db.query.lineups.findMany({
    where: and(eq(lineups.matchId, Number(matchId)), eq(lineups.teamId, Number(teamId))),
    with: { player: true },
  });
  res.json(saved);
});

export default router;
