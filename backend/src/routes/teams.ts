import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import db from '../db/index';
import { teams, players } from '../db/schema';

const router = Router();

// GET /api/teams
router.get('/', async (_req, res) => {
  const result = await db.select().from(teams).orderBy(asc(teams.group), asc(teams.name));
  res.json(result);
});

// GET /api/teams/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, id),
    with: { players: { orderBy: asc(players.shirtNumber) } },
  });
  if (!team) return res.status(404).json({ error: 'Equipa não encontrada' });
  res.json(team);
});

// POST /api/teams
router.post('/', async (req, res) => {
  const { name, code, group, flagUrl, defaultFormation } = req.body;
  if (!name || !code || !group) return res.status(400).json({ error: 'name, code e group são obrigatórios' });
  const [team] = await db.insert(teams).values({ name, code, group, flagUrl: flagUrl || '', defaultFormation: defaultFormation || '4-4-2' }).returning();
  res.status(201).json(team);
});

// PATCH /api/teams/:id
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, flagUrl, defaultFormation } = req.body;
  const updateData: Record<string, string> = {};
  if (name) updateData.name = name;
  if (flagUrl !== undefined) updateData.flagUrl = flagUrl;
  if (defaultFormation) updateData.defaultFormation = defaultFormation;
  const [updated] = await db.update(teams).set(updateData).where(eq(teams.id, id)).returning();
  if (!updated) return res.status(404).json({ error: 'Equipa não encontrada' });
  res.json(updated);
});

export default router;
