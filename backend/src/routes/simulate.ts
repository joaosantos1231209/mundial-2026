import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../db/index';
import { teams, matches } from '../db/schema';

const router = Router();

interface TeamStat {
  id: number;
  name: string;
  code: string;
  flagUrl: string;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  played: number;
}

function sortGroup(stats: TeamStat[]): TeamStat[] {
  return [...stats].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
}

// POST /api/simulate/group/:groupName
// Body: { simResults: [{ matchId, homeScore, awayScore }] }
router.post('/group/:groupName', async (req, res) => {
  const { groupName } = req.params;
  const simResults: Array<{ matchId: number; homeScore: number; awayScore: number }> = req.body.simResults || [];

  const groupTeams = await db.select().from(teams).where(eq(teams.group, groupName));
  const groupMatches = await db.query.matches.findMany({
    where: and(eq(matches.groupName, groupName)),
    with: { homeTeam: true, awayTeam: true },
  });

  const stats: Record<number, TeamStat> = {};
  for (const t of groupTeams) {
    stats[t.id] = { id: t.id, name: t.name, code: t.code, flagUrl: t.flagUrl, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 };
  }

  // Build effective results: real for finished, simulated for others
  const simMap = Object.fromEntries(simResults.map(r => [r.matchId, r]));

  for (const m of groupMatches) {
    let hs: number, as_: number;
    if (m.status === 'Finished' && m.homeScore !== null && m.awayScore !== null) {
      hs = m.homeScore;
      as_ = m.awayScore;
    } else if (simMap[m.id] !== undefined) {
      hs = simMap[m.id].homeScore;
      as_ = simMap[m.id].awayScore;
    } else {
      continue; // not played, not simulated
    }

    if (!stats[m.homeTeamId] || !stats[m.awayTeamId]) continue;
    stats[m.homeTeamId].gf += hs; stats[m.homeTeamId].ga += as_; stats[m.homeTeamId].played++;
    stats[m.awayTeamId].gf += as_; stats[m.awayTeamId].ga += hs; stats[m.awayTeamId].played++;
    if (hs > as_) {
      stats[m.homeTeamId].w++; stats[m.homeTeamId].pts += 3; stats[m.awayTeamId].l++;
    } else if (hs === as_) {
      stats[m.homeTeamId].d++; stats[m.homeTeamId].pts++;
      stats[m.awayTeamId].d++; stats[m.awayTeamId].pts++;
    } else {
      stats[m.awayTeamId].w++; stats[m.awayTeamId].pts += 3; stats[m.homeTeamId].l++;
    }
  }

  const sorted = sortGroup(Object.values(stats));
  const matchesWithSim = groupMatches.map(m => ({
    ...m,
    simHomeScore: simMap[m.id]?.homeScore ?? null,
    simAwayScore: simMap[m.id]?.awayScore ?? null,
    isSimulated: simMap[m.id] !== undefined && m.status !== 'Finished',
  }));

  res.json({ standings: sorted, matches: matchesWithSim });
});

// GET /api/simulate/best-thirds — calcula os 4 melhores 3ºs de todos os grupos (para o bracket)
router.get('/best-thirds', async (_req, res) => {
  const allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const thirds: Array<TeamStat & { group: string }> = [];

  for (const groupName of allGroups) {
    const groupTeams = await db.select().from(teams).where(eq(teams.group, groupName));
    const groupMatches = await db.select().from(matches)
      .where(and(eq(matches.groupName, groupName), eq(matches.status, 'Finished')));

    const stats: Record<number, TeamStat> = {};
    for (const t of groupTeams) {
      stats[t.id] = { id: t.id, name: t.name, code: t.code, flagUrl: t.flagUrl, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 };
    }
    for (const m of groupMatches) {
      if (m.homeScore === null || m.awayScore === null) continue;
      const hs = m.homeScore; const as_ = m.awayScore;
      if (!stats[m.homeTeamId] || !stats[m.awayTeamId]) continue;
      stats[m.homeTeamId].gf += hs; stats[m.homeTeamId].ga += as_; stats[m.homeTeamId].played++;
      stats[m.awayTeamId].gf += as_; stats[m.awayTeamId].ga += hs; stats[m.awayTeamId].played++;
      if (hs > as_) { stats[m.homeTeamId].w++; stats[m.homeTeamId].pts += 3; stats[m.awayTeamId].l++; }
      else if (hs === as_) { stats[m.homeTeamId].d++; stats[m.homeTeamId].pts++; stats[m.awayTeamId].d++; stats[m.awayTeamId].pts++; }
      else { stats[m.awayTeamId].w++; stats[m.awayTeamId].pts += 3; stats[m.homeTeamId].l++; }
    }
    const sorted = sortGroup(Object.values(stats));
    if (sorted[2]) thirds.push({ ...sorted[2], group: groupName });
  }

  const bestThirds = sortGroup(thirds).slice(0, 8);
  res.json(bestThirds);
});

export default router;
