import { Router } from 'express';
import { desc, asc, eq, and, or, sql } from 'drizzle-orm';
import db from '../db/index';
import { players, teams, matches, matchEvents } from '../db/schema';

const router = Router();

// GET /api/stats/top-scorers
router.get('/top-scorers', async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const result = await db.query.players.findMany({
    with: { team: true },
    orderBy: [desc(players.goals), desc(players.assists)],
  });
  res.json(result.filter(p => p.goals > 0).slice(0, limit));
});

// GET /api/stats/top-assists
router.get('/top-assists', async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const result = await db.query.players.findMany({
    with: { team: true },
    orderBy: [desc(players.assists), desc(players.goals)],
  });
  res.json(result.filter(p => p.assists > 0).slice(0, limit));
});

// GET /api/stats/groups — all group standings
router.get('/groups', async (req, res) => {
  const allTeams = await db.select().from(teams).orderBy(asc(teams.group), desc(teams.points), desc(teams.goalsFor));
  const allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const grouped = Object.fromEntries(
    allGroups.map(g => [g, allTeams.filter(t => t.group === g)])
  );
  res.json(grouped);
});

// GET /api/stats/overview
router.get('/overview', async (_req, res) => {
  const topScorers = await db.query.players.findMany({
    with: { team: true },
    orderBy: [desc(players.goals), desc(players.assists)],
  });
  const topAssists = await db.query.players.findMany({
    with: { team: true },
    orderBy: [desc(players.assists), desc(players.goals)],
  });
  res.json({
    topScorers: topScorers.filter(p => p.goals > 0).slice(0, 5),
    topAssists: topAssists.filter(p => p.assists > 0).slice(0, 5),
  });
});

// GET /api/stats/goals-by-minute — distribuição de golos por quarto de hora
router.get('/goals-by-minute', async (_req, res) => {
  const goalEvents = await db.select().from(matchEvents)
    .where(or(eq(matchEvents.eventType, 'Goal'), eq(matchEvents.eventType, 'OwnGoal')));

  const buckets: Record<string, number> = {
    '1-15': 0, '16-30': 0, '31-45': 0, '45+': 0,
    '46-60': 0, '61-75': 0, '76-90': 0, '90+': 0,
  };

  for (const ev of goalEvents) {
    const min = ev.minute ?? 0;
    if (min >= 91) buckets['90+']++;
    else if (min >= 76) buckets['76-90']++;
    else if (min >= 61) buckets['61-75']++;
    else if (min >= 46) buckets['46-60']++;
    else if (min >= 45) buckets['45+']++;
    else if (min >= 31) buckets['31-45']++;
    else if (min >= 16) buckets['16-30']++;
    else buckets['1-15']++;
  }

  const result = Object.entries(buckets).map(([period, goals]) => ({ period, goals }));
  res.json(result);
});

// GET /api/stats/radar/:teamId — dados para gráfico radar de uma equipa
router.get('/radar/:teamId', async (req, res) => {
  const teamId = Number(req.params.teamId);
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return res.status(404).json({ error: 'Equipa não encontrada' });

  // Stats from finished group matches
  const teamMatches = await db.query.matches.findMany({
    where: and(eq(matches.status, 'Finished')),
    with: { homeTeam: true, awayTeam: true, events: { with: { player: true } } },
  });

  const myMatches = teamMatches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
  let goalsScored = 0, goalsConceded = 0, yellowCards = 0, redCards = 0;
  const playerGoals = await db.query.players.findMany({
    where: eq(players.teamId, teamId),
  });
  for (const m of myMatches) {
    const isHome = m.homeTeamId === teamId;
    goalsScored += isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    goalsConceded += isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    const myEvents = m.events.filter(e => e.teamId === teamId || (e.player && e.player.teamId === teamId));
    yellowCards += myEvents.filter(e => e.eventType === 'Yellow').length;
    redCards += myEvents.filter(e => e.eventType === 'Red').length;
  }

  const gamesPlayed = myMatches.length || 1;
  res.json({
    teamId, name: team.name, code: team.code, flagUrl: team.flagUrl,
    metrics: [
      { subject: 'Ataque', value: Math.min(100, Math.round((goalsScored / gamesPlayed) * 25)) },
      { subject: 'Defesa', value: Math.min(100, Math.round(Math.max(0, (3 - goalsConceded / gamesPlayed)) * 33)) },
      { subject: 'Disciplina', value: Math.min(100, Math.max(0, 100 - (yellowCards * 5 + redCards * 15))) },
      { subject: 'Golos/Jogo', value: Math.min(100, Math.round((goalsScored / gamesPlayed) * 33)) },
    ],
  });
});

// GET /api/stats/efficiency — ranking de eficiência das equipas
router.get('/efficiency', async (_req, res) => {
  const allTeams = await db.select().from(teams);
  const allPlayers = await db.query.players.findMany({ with: { team: true } });
  const finishedMatches = await db.select().from(matches).where(eq(matches.status, 'Finished'));

  const result = allTeams.map(team => {
    const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
    const totalYellow = teamPlayers.reduce((s, p) => s + p.yellowCards, 0);
    const totalRed = teamPlayers.reduce((s, p) => s + p.redCards, 0);
    const totalFouls = teamPlayers.reduce((s, p) => s + p.fouls, 0);

    const teamMatches = finishedMatches.filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id);

    return {
      id: team.id, name: team.name, code: team.code, flagUrl: team.flagUrl, group: team.group,
      goalsFor: team.goalsFor, goalsAgainst: team.goalsAgainst,
      gamesPlayed: teamMatches.length,
      totalYellow, totalRed, totalFouls,
      avgGoalsPerGame: teamMatches.length > 0 ? Math.round((team.goalsFor / teamMatches.length) * 10) / 10 : 0,
    };
  }).filter(t => t.gamesPlayed > 0);

  res.json(result);
});

export default router;
