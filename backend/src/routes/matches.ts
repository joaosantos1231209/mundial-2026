import { Router } from 'express';
import { eq, and, asc, desc } from 'drizzle-orm';
import db from '../db/index';
import { matches, matchEvents, teams, players } from '../db/schema';

const router = Router();

async function recalculateGroup(groupName: string) {
  const groupTeams = await db.select().from(teams).where(eq(teams.group, groupName));
  await db.update(teams)
    .set({ wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })
    .where(eq(teams.group, groupName));

  const finished = await db.select().from(matches)
    .where(and(eq(matches.groupName, groupName), eq(matches.status, 'Finished')));

  const stats: Record<number, { w: number; d: number; l: number; gf: number; ga: number; pts: number }> = {};
  for (const t of groupTeams) stats[t.id] = { w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };

  for (const m of finished) {
    const hs = m.homeScore!;
    const as_ = m.awayScore!;
    if (!stats[m.homeTeamId] || !stats[m.awayTeamId]) continue;
    stats[m.homeTeamId].gf += hs; stats[m.homeTeamId].ga += as_;
    stats[m.awayTeamId].gf += as_; stats[m.awayTeamId].ga += hs;
    if (hs > as_) {
      stats[m.homeTeamId].w++; stats[m.homeTeamId].pts += 3; stats[m.awayTeamId].l++;
    } else if (hs === as_) {
      stats[m.homeTeamId].d++; stats[m.homeTeamId].pts++;
      stats[m.awayTeamId].d++; stats[m.awayTeamId].pts++;
    } else {
      stats[m.awayTeamId].w++; stats[m.awayTeamId].pts += 3; stats[m.homeTeamId].l++;
    }
  }

  for (const [id, s] of Object.entries(stats)) {
    await db.update(teams)
      .set({ wins: s.w, draws: s.d, losses: s.l, goalsFor: s.gf, goalsAgainst: s.ga, points: s.pts })
      .where(eq(teams.id, Number(id)));
  }
}

// GET /api/matches?group=A&stage=Group&status=Finished
router.get('/', async (req, res) => {
  const { group, stage, status } = req.query;
  const allMatches = await db.query.matches.findMany({
    with: { homeTeam: true, awayTeam: true, motmPlayer: true },
    orderBy: asc(matches.date),
  });
  let filtered = allMatches;
  if (group) filtered = filtered.filter(m => m.groupName === group);
  if (stage) filtered = filtered.filter(m => m.stage === stage);
  if (status) filtered = filtered.filter(m => m.status === status);
  res.json(filtered);
});

// GET /api/matches/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, id),
    with: {
      homeTeam: true,
      awayTeam: true,
      motmPlayer: { with: { team: true } },
      events: {
        with: { player: true, team: true },
        orderBy: asc(matchEvents.minute),
      },
    },
  });
  if (!match) return res.status(404).json({ error: 'Jogo não encontrado' });
  res.json(match);
});

// POST /api/matches
router.post('/', async (req, res) => {
  const { stage, groupName, homeTeamId, awayTeamId, date, venue } = req.body;
  if (!homeTeamId || !awayTeamId || !date) return res.status(400).json({ error: 'homeTeamId, awayTeamId e date são obrigatórios' });
  const [match] = await db.insert(matches).values({
    stage: stage || 'Group', groupName: groupName || null,
    homeTeamId: Number(homeTeamId), awayTeamId: Number(awayTeamId),
    date, venue: venue || '', status: 'Scheduled',
  }).returning();
  res.status(201).json(match);
});

// PATCH /api/matches/:id/schedule — update date/time (manual override, não afetado pelo sync)
router.patch('/:id/schedule', async (req, res) => {
  const id = Number(req.params.id);
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date é obrigatório' });
  const [updated] = await db.update(matches).set({ date }).where(eq(matches.id, id)).returning();
  if (!updated) return res.status(404).json({ error: 'Jogo não encontrado' });
  res.json(updated);
});

// PATCH /api/matches/:id/result — enter/update score
router.patch('/:id/result', async (req, res) => {
  const id = Number(req.params.id);
  const { homeScore, awayScore, status, motmPlayerId } = req.body;

  const existing = await db.query.matches.findFirst({ where: eq(matches.id, id) });
  if (!existing) return res.status(404).json({ error: 'Jogo não encontrado' });

  const updateData: Partial<typeof matches.$inferInsert> = {
    homeScore: homeScore !== undefined ? Number(homeScore) : existing.homeScore,
    awayScore: awayScore !== undefined ? Number(awayScore) : existing.awayScore,
    status: status || existing.status,
    motmPlayerId: motmPlayerId !== undefined ? (motmPlayerId ? Number(motmPlayerId) : null) : existing.motmPlayerId,
  };

  const [updated] = await db.update(matches).set(updateData).where(eq(matches.id, id)).returning();

  if (updated.stage === 'Group' && updated.groupName) {
    await recalculateGroup(updated.groupName);
  }

  const full = await db.query.matches.findFirst({
    where: eq(matches.id, id),
    with: { homeTeam: true, awayTeam: true },
  });
  res.json(full);
});

// POST /api/matches/:id/events — add event (goal, card, assist)
router.post('/:id/events', async (req, res) => {
  const matchId = Number(req.params.id);
  const { playerId, teamId, eventType, minute, description } = req.body;
  if (!eventType) return res.status(400).json({ error: 'eventType é obrigatório' });

  const [event] = await db.insert(matchEvents).values({
    matchId, playerId: playerId ? Number(playerId) : null,
    teamId: teamId ? Number(teamId) : null,
    eventType, minute: minute ? Number(minute) : null,
    description: description || '',
  }).returning();

  // Update player stats
  if (playerId) {
    const pid = Number(playerId);
    const p = await db.select().from(players).where(eq(players.id, pid)).then(r => r[0]);
    if (p) {
      if (eventType === 'Goal') await db.update(players).set({ goals: p.goals + 1 }).where(eq(players.id, pid));
      if (eventType === 'Assist') await db.update(players).set({ assists: p.assists + 1 }).where(eq(players.id, pid));
      if (eventType === 'Yellow') await db.update(players).set({ yellowCards: p.yellowCards + 1 }).where(eq(players.id, pid));
      if (eventType === 'Red') await db.update(players).set({ redCards: p.redCards + 1 }).where(eq(players.id, pid));
    }
  }

  const full = await db.query.matchEvents.findFirst({
    where: eq(matchEvents.id, event.id),
    with: { player: true, team: true },
  });
  res.status(201).json(full);
});

// DELETE /api/matches/:id/events/:eventId
router.delete('/:id/events/:eventId', async (req, res) => {
  const eventId = Number(req.params.eventId);
  const ev = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).then(r => r[0]);
  if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });

  // Reverse player stats
  if (ev.playerId) {
    const p = await db.select().from(players).where(eq(players.id, ev.playerId)).then(r => r[0]);
    if (p) {
      if (ev.eventType === 'Goal') await db.update(players).set({ goals: Math.max(0, p.goals - 1) }).where(eq(players.id, p.id));
      if (ev.eventType === 'Assist') await db.update(players).set({ assists: Math.max(0, p.assists - 1) }).where(eq(players.id, p.id));
      if (ev.eventType === 'Yellow') await db.update(players).set({ yellowCards: Math.max(0, p.yellowCards - 1) }).where(eq(players.id, p.id));
      if (ev.eventType === 'Red') await db.update(players).set({ redCards: Math.max(0, p.redCards - 1) }).where(eq(players.id, p.id));
    }
  }

  await db.delete(matchEvents).where(eq(matchEvents.id, eventId));
  res.json({ success: true });
});

// GET /api/matches/:id/espn — dados ao vivo da ESPN (formações + stats)
router.get('/:id/espn', async (req, res) => {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, Number(req.params.id)),
    with: { homeTeam: true, awayTeam: true },
  });
  if (!match) return res.status(404).json({ error: 'Jogo não encontrado' });
  if (!match.espnEventId) return res.status(404).json({ error: 'Sem ID ESPN — faz sync de resultados primeiro' });

  try {
    const espnRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.World/summary?event=${match.espnEventId}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!espnRes.ok) return res.status(502).json({ error: `ESPN HTTP ${espnRes.status}` });

    const data = await espnRes.json() as any;
    const rosters: any[] = data.rosters || [];
    const boxscoreTeams: any[] = data.boxscore?.teams || [];

    // Formações e titulares
    const lineups = rosters.map((r: any) => ({
      homeAway: r.homeAway as 'home' | 'away',
      formation: r.formation as string,
      starters: (r.roster || [])
        .filter((p: any) => p.starter)
        .sort((a: any, b: any) => Number(a.formationPlace) - Number(b.formationPlace))
        .map((p: any) => ({
          name: p.athlete?.displayName as string,
          jersey: p.jersey as string,
          position: p.position?.abbreviation as string,
          formationPlace: Number(p.formationPlace),
          subbedOut: p.subbedOut as boolean,
          stats: Object.fromEntries((p.stats || []).map((s: any) => [s.name, s.displayValue])),
        })),
      bench: (r.roster || [])
        .filter((p: any) => !p.starter && p.active)
        .map((p: any) => ({
          name: p.athlete?.displayName as string,
          jersey: p.jersey as string,
          position: p.position?.abbreviation as string,
          subbedIn: p.subbedIn as boolean,
        })),
    }));

    // Estatísticas de equipa
    const teamStats = boxscoreTeams.map((t: any) => ({
      teamId: t.team?.id as string,
      teamName: t.team?.displayName as string,
      stats: Object.fromEntries((t.statistics || []).map((s: any) => [s.name, s.displayValue])),
    }));

    res.json({
      homeTeam: { id: match.homeTeamId, name: match.homeTeam?.name, flagUrl: match.homeTeam?.flagUrl },
      awayTeam: { id: match.awayTeamId, name: match.awayTeam?.name, flagUrl: match.awayTeam?.flagUrl },
      lineups,
      teamStats,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/matches/generate-knockout — cria os 16 jogos da fase dos 32 com base nos grupos
router.post('/generate-knockout', async (_req, res) => {
  const existing = await db.select().from(matches).where(eq(matches.stage, 'Round of 32'));
  if (existing.length > 0) {
    return res.status(409).json({ error: `Já existem ${existing.length} jogos da fase dos 32. Remove-os primeiro se quiseres regenerar.` });
  }

  const allTeams = await db.select().from(teams);
  const allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  function sortTeams(ts: typeof allTeams) {
    return [...ts].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
  }

  const standings: Record<string, typeof allTeams> = {};
  for (const g of allGroups) {
    standings[g] = sortTeams(allTeams.filter(t => t.group === g));
  }

  const thirds = allGroups
    .map(g => standings[g]?.[2])
    .filter(Boolean)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    })
    .slice(0, 8);

  // FIFA 2026 R32 bracket — first 12 slots: group winners vs runners-up
  // Last 4 slots: best thirds pairings
  const pairings: Array<[typeof allTeams[0] | undefined, typeof allTeams[0] | undefined]> = [
    [standings['A']?.[0], standings['B']?.[1]],
    [standings['C']?.[0], standings['D']?.[1]],
    [standings['E']?.[0], standings['F']?.[1]],
    [standings['G']?.[0], standings['H']?.[1]],
    [standings['I']?.[0], standings['J']?.[1]],
    [standings['K']?.[0], standings['L']?.[1]],
    [standings['B']?.[0], standings['A']?.[1]],
    [standings['D']?.[0], standings['C']?.[1]],
    [standings['F']?.[0], standings['E']?.[1]],
    [standings['H']?.[0], standings['G']?.[1]],
    [standings['J']?.[0], standings['I']?.[1]],
    [standings['L']?.[0], standings['K']?.[1]],
    [thirds[0], thirds[1]],
    [thirds[2], thirds[3]],
    [thirds[4], thirds[5]],
    [thirds[6], thirds[7]],
  ];

  // Dates: June 26–July 3 2026, 2 per day at 18:00 and 22:00 UTC
  const toCreate: Array<typeof matches.$inferInsert> = [];
  for (let i = 0; i < 16; i++) {
    const [home, away] = pairings[i];
    if (!home || !away) continue;
    const dayOffset = Math.floor(i / 2);
    const hourOffset = (i % 2) * 4;
    const dt = new Date(`2026-06-26T${String(18 + hourOffset).padStart(2, '0')}:00:00Z`);
    dt.setDate(dt.getDate() + dayOffset);
    toCreate.push({
      stage: 'Round of 32',
      homeTeamId: home.id,
      awayTeamId: away.id,
      status: 'Scheduled',
      date: dt.toISOString(),
      venue: '',
    });
  }

  if (toCreate.length === 0) return res.status(400).json({ error: 'Sem equipas suficientes — verifica que todos os grupos têm pelo menos 2 equipas' });

  const created = await db.insert(matches).values(toCreate).returning();
  res.json({ success: true, created: created.length, message: `${created.length} jogos da fase dos 32 criados!` });
});

export default router;
