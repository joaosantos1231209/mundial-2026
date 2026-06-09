import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import db from '../db/index';
import { players, teams, matches, matchEvents } from '../db/schema';

const router = Router();

// GET /api/players?teamId=X
router.get('/', async (req, res) => {
  const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;
  const result = await db.query.players.findMany({
    where: teamId ? eq(players.teamId, teamId) : undefined,
    with: { team: true },
    orderBy: asc(players.shirtNumber),
  });
  res.json(result);
});

// GET /api/players/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const player = await db.query.players.findFirst({
    where: eq(players.id, id),
    with: { team: true },
  });
  if (!player) return res.status(404).json({ error: 'Jogador não encontrado' });
  res.json(player);
});

// POST /api/players
router.post('/', async (req, res) => {
  const { name, teamId, position, shirtNumber } = req.body;
  if (!name || !teamId || !position) return res.status(400).json({ error: 'name, teamId e position são obrigatórios' });
  const [player] = await db.insert(players).values({
    name, teamId: Number(teamId), position, shirtNumber: shirtNumber ? Number(shirtNumber) : undefined,
  }).returning();
  res.status(201).json(player);
});

// PATCH /api/players/:id
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, position, shirtNumber, goals, assists, yellowCards, redCards, cleanSheets,
    minutesPlayed, shots, shotsOnTarget, fouls,
    isCaptain, isCornerKicker, isFreekickTaker, isPenaltyTaker } = req.body;
  const updateData: Partial<typeof players.$inferInsert> = {};
  if (name !== undefined) updateData.name = name;
  if (position !== undefined) updateData.position = position;
  if (shirtNumber !== undefined) updateData.shirtNumber = Number(shirtNumber);
  if (goals !== undefined) updateData.goals = Number(goals);
  if (assists !== undefined) updateData.assists = Number(assists);
  if (yellowCards !== undefined) updateData.yellowCards = Number(yellowCards);
  if (redCards !== undefined) updateData.redCards = Number(redCards);
  if (cleanSheets !== undefined) updateData.cleanSheets = Number(cleanSheets);
  if (minutesPlayed !== undefined) updateData.minutesPlayed = Number(minutesPlayed);
  if (shots !== undefined) updateData.shots = Number(shots);
  if (shotsOnTarget !== undefined) updateData.shotsOnTarget = Number(shotsOnTarget);
  if (fouls !== undefined) updateData.fouls = Number(fouls);
  if (isCaptain !== undefined) updateData.isCaptain = isCaptain ? 1 : 0;
  if (isCornerKicker !== undefined) updateData.isCornerKicker = isCornerKicker ? 1 : 0;
  if (isFreekickTaker !== undefined) updateData.isFreekickTaker = isFreekickTaker ? 1 : 0;
  if (isPenaltyTaker !== undefined) updateData.isPenaltyTaker = isPenaltyTaker ? 1 : 0;
  const [updated] = await db.update(players).set(updateData).where(eq(players.id, id)).returning();
  if (!updated) return res.status(404).json({ error: 'Jogador não encontrado' });
  res.json(updated);
});

// GET /api/players/:id/history — minutos jogados + eventos por jogo
router.get('/:id/history', async (req, res) => {
  const id = Number(req.params.id);
  const player = await db.query.players.findFirst({
    where: eq(players.id, id),
    with: { team: true },
  });
  if (!player) return res.status(404).json({ error: 'Jogador não encontrado' });

  // All events for this player
  const events = await db.query.matchEvents.findMany({
    where: eq(matchEvents.playerId, id),
    with: {
      match: { with: { homeTeam: true, awayTeam: true } },
    },
  });

  // Group events by match
  const byMatch: Record<number, { match: any; events: typeof events }> = {};
  for (const ev of events) {
    if (!ev.match) continue;
    if (!byMatch[ev.match.id]) byMatch[ev.match.id] = { match: ev.match, events: [] };
    byMatch[ev.match.id].events.push(ev);
  }

  const history = Object.values(byMatch).map(({ match, events: evs }) => ({
    match: {
      id: match.id,
      date: match.date,
      stage: match.stage,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: match.status,
    },
    goals: evs.filter(e => e.eventType === 'Goal').length,
    assists: evs.filter(e => e.eventType === 'Assist').length,
    yellowCards: evs.filter(e => e.eventType === 'Yellow').length,
    redCards: evs.filter(e => e.eventType === 'Red').length,
    events: evs.map(e => ({ type: e.eventType, minute: e.minute, description: e.description })),
  })).sort((a, b) => a.match.date.localeCompare(b.match.date));

  res.json({ player, history });
});

// DELETE /api/players/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(players).where(eq(players.id, id));
  res.json({ success: true });
});

export default router;
