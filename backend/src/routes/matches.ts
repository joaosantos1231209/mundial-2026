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

// GET /api/matches/:id/espn — formações + stats (BD cache primeiro, ESPN só se Live e sem cache)
router.get('/:id/espn', async (req, res) => {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, Number(req.params.id)),
    with: { homeTeam: true, awayTeam: true },
  });
  if (!match) return res.status(404).json({ error: 'Jogo não encontrado' });
  if (!match.espnEventId) return res.status(404).json({ error: 'Sem ID ESPN — faz sync de resultados primeiro' });

  // Servir da BD se temos cache (sempre para jogos terminados, fallback para Live)
  if (match.espnCacheJson && match.status !== 'Live') {
    return res.json(JSON.parse(match.espnCacheJson));
  }

  // Para jogos Live (ou sem cache ainda), ir à ESPN e guardar
  try {
    const espnRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.World/summary?event=${match.espnEventId}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!espnRes.ok) {
      // Fallback para cache se ESPN falhar
      if (match.espnCacheJson) return res.json(JSON.parse(match.espnCacheJson));
      return res.status(502).json({ error: `ESPN HTTP ${espnRes.status}` });
    }

    const data = await espnRes.json() as any;
    const rosters: any[] = data.rosters || [];
    const boxscoreTeams: any[] = data.boxscore?.teams || [];

    const lineupData = rosters.map((r: any) => ({
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

    const teamStats = boxscoreTeams.map((t: any) => ({
      teamId: t.team?.id as string,
      teamName: t.team?.displayName as string,
      stats: Object.fromEntries((t.statistics || []).map((s: any) => [s.name, s.displayValue])),
    }));

    const payload = {
      homeTeam: { id: match.homeTeamId, name: match.homeTeam?.name, flagUrl: match.homeTeam?.flagUrl },
      awayTeam: { id: match.awayTeamId, name: match.awayTeam?.name, flagUrl: match.awayTeam?.flagUrl },
      lineups: lineupData,
      teamStats,
    };

    // Responder primeiro, guardar cache em background
    res.json(payload);
    db.update(matches).set({ espnCacheJson: JSON.stringify(payload) }).where(eq(matches.id, match.id)).catch(() => {});
  } catch (err: any) {
    if (match.espnCacheJson) return res.json(JSON.parse(match.espnCacheJson));
    res.status(502).json({ error: err.message });
  }
});

// POST /api/matches/seed-group-stage — insere os 72 jogos oficiais da fase de grupos FIFA 2026
router.post('/seed-group-stage', async (req, res) => {
  const force = req.query.force === 'true';
  const existing = await db.select().from(matches).where(eq(matches.stage, 'Group'));
  if (existing.length > 0 && !force) {
    return res.status(409).json({ error: `Já existem ${existing.length} jogos da fase de grupos. Usa force=true para re-semear (apaga os existentes).`, canForce: true });
  }
  if (existing.length > 0 && force) {
    const playedCount = existing.filter(m => m.status === 'Finished' || m.status === 'Live').length;
    if (playedCount > 0) {
      return res.status(409).json({ error: `${playedCount} jogo(s) já foram jogados — não é seguro apagar.` });
    }
    const ids = existing.map(m => m.id);
    for (const id of ids) {
      await db.delete(matchEvents).where(eq(matchEvents.matchId, id));
    }
    await db.delete(matches).where(eq(matches.stage, 'Group'));
  }

  const allTeams = await db.select().from(teams);
  const byName = Object.fromEntries(allTeams.map(t => [t.name, t]));

  // Horários em ET (UTC-4 verão) → convertidos para hora Portugal WEST (UTC+1) = ET+5h
  function etToPt(etDatetime: string): string {
    const [datePart, timePart] = etDatetime.split('T');
    const h = parseInt(timePart.split(':')[0]);
    const min = timePart.split(':')[1] ?? '00';
    const ptH = h + 5;
    if (ptH < 24) return `${datePart}T${String(ptH).padStart(2, '0')}:${min}`;
    const d = new Date(datePart + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return `${d.toISOString().split('T')[0]}T${String(ptH - 24).padStart(2, '0')}:${min}`;
  }

  // Calendário oficial FIFA World Cup 2026 (fonte: calendário oficial FIFA v17, Abril 2026)
  // Todos os horários em ET (Eastern Time, UTC-4)
  const schedule = [
    // GRUPO A — MEX, RSA, KOR, CZE
    { date: '2026-06-11T15:00', home: 'Mexico', away: 'South Africa', group: 'A', venue: 'Estadio Azteca, Cidade do México' },
    { date: '2026-06-11T22:00', home: 'South Korea', away: 'Czechia', group: 'A', venue: 'Estadio Akron, Guadalajara' },
    { date: '2026-06-17T12:00', home: 'Czechia', away: 'South Africa', group: 'A', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-06-17T21:00', home: 'Mexico', away: 'South Korea', group: 'A', venue: 'Estadio Akron, Guadalajara' },
    { date: '2026-06-23T15:00', home: 'South Africa', away: 'South Korea', group: 'A', venue: 'Estadio BBVA, Monterrey' },
    { date: '2026-06-23T15:00', home: 'Czechia', away: 'Mexico', group: 'A', venue: 'Estadio Banorte, México' },
    // GRUPO B — CAN, BIH, QAT, SUI
    { date: '2026-06-12T15:00', home: 'Canada', away: 'Bosnia-Herzegovina', group: 'B', venue: 'BMO Field, Toronto' },
    { date: '2026-06-13T15:00', home: 'Qatar', away: 'Switzerland', group: 'B', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-18T12:00', home: 'Switzerland', away: 'Bosnia-Herzegovina', group: 'B', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-18T15:00', home: 'Canada', away: 'Qatar', group: 'B', venue: 'BC Place, Vancouver' },
    { date: '2026-06-23T19:00', home: 'Switzerland', away: 'Canada', group: 'B', venue: 'BC Place, Vancouver' },
    { date: '2026-06-23T19:00', home: 'Bosnia-Herzegovina', away: 'Qatar', group: 'B', venue: 'Lumen Field, Seattle' },
    // GRUPO C — BRA, MAR, HAI, SCO
    { date: '2026-06-13T12:00', home: 'Brazil', away: 'Morocco', group: 'C', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-13T21:00', home: 'Haiti', away: 'Scotland', group: 'C', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-19T12:00', home: 'Scotland', away: 'Morocco', group: 'C', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-19T15:00', home: 'Brazil', away: 'Haiti', group: 'C', venue: 'Lincoln Financial Field, Filadélfia' },
    { date: '2026-06-24T15:00', home: 'Morocco', away: 'Haiti', group: 'C', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-06-24T15:00', home: 'Scotland', away: 'Brazil', group: 'C', venue: 'Hard Rock Stadium, Miami' },
    // GRUPO D — USA, PAR, AUS, TUR
    { date: '2026-06-12T21:00', home: 'United States', away: 'Paraguay', group: 'D', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-13T18:00', home: 'Australia', away: 'Türkiye', group: 'D', venue: 'BC Place, Vancouver' },
    { date: '2026-06-19T18:00', home: 'United States', away: 'Australia', group: 'D', venue: 'Lumen Field, Seattle' },
    { date: '2026-06-19T21:00', home: 'Türkiye', away: 'Paraguay', group: 'D', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-24T19:00', home: 'Türkiye', away: 'United States', group: 'D', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-24T19:00', home: 'Paraguay', away: 'Australia', group: 'D', venue: "Levi's Stadium, Santa Clara" },
    // GRUPO E — GER, CUW, CIV, ECU
    { date: '2026-06-14T13:00', home: 'Germany', away: 'Curaçao', group: 'E', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-14T19:00', home: 'Ivory Coast', away: 'Ecuador', group: 'E', venue: 'Lincoln Financial Field, Filadélfia' },
    { date: '2026-06-20T16:00', home: 'Germany', away: 'Ivory Coast', group: 'E', venue: 'BMO Field, Toronto' },
    { date: '2026-06-20T20:00', home: 'Ecuador', away: 'Curaçao', group: 'E', venue: 'Arrowhead Stadium, Kansas City' },
    { date: '2026-06-25T15:00', home: 'Ecuador', away: 'Germany', group: 'E', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-25T15:00', home: 'Curaçao', away: 'Ivory Coast', group: 'E', venue: 'Lincoln Financial Field, Filadélfia' },
    // GRUPO F — NED, JPN, SWE, TUN
    { date: '2026-06-14T16:00', home: 'Netherlands', away: 'Japan', group: 'F', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-14T22:00', home: 'Sweden', away: 'Tunisia', group: 'F', venue: 'Estadio BBVA, Monterrey' },
    { date: '2026-06-20T13:00', home: 'Netherlands', away: 'Sweden', group: 'F', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-21T00:00', home: 'Tunisia', away: 'Japan', group: 'F', venue: 'Estadio BBVA, Monterrey' },
    { date: '2026-06-25T16:00', home: 'Japan', away: 'Sweden', group: 'F', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-25T16:00', home: 'Tunisia', away: 'Netherlands', group: 'F', venue: 'Arrowhead Stadium, Kansas City' },
    // GRUPO G — BEL, EGY, IRN, NZL
    { date: '2026-06-15T15:00', home: 'Belgium', away: 'Egypt', group: 'G', venue: 'Lumen Field, Seattle' },
    { date: '2026-06-15T21:00', home: 'Iran', away: 'New Zealand', group: 'G', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-21T15:00', home: 'New Zealand', away: 'Egypt', group: 'G', venue: 'BC Place, Vancouver' },
    { date: '2026-06-21T23:00', home: 'Belgium', away: 'Iran', group: 'G', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-26T22:00', home: 'New Zealand', away: 'Belgium', group: 'G', venue: 'BC Place, Vancouver' },
    { date: '2026-06-26T22:00', home: 'Egypt', away: 'Iran', group: 'G', venue: 'Lumen Field, Seattle' },
    // GRUPO H — ESP, CPV, KSA, URU
    { date: '2026-06-15T12:00', home: 'Spain', away: 'Cape Verde', group: 'H', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-06-15T18:00', home: 'Saudi Arabia', away: 'Uruguay', group: 'H', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-06-21T12:00', home: 'Spain', away: 'Saudi Arabia', group: 'H', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-06-21T18:00', home: 'Uruguay', away: 'Cape Verde', group: 'H', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-06-26T17:00', home: 'Cape Verde', away: 'Saudi Arabia', group: 'H', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-26T17:00', home: 'Uruguay', away: 'Spain', group: 'H', venue: 'Estadio Akron, Guadalajara' },
    // GRUPO I — FRA, SEN, IRQ, NOR
    { date: '2026-06-16T15:00', home: 'France', away: 'Senegal', group: 'I', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-16T18:00', home: 'Iraq', away: 'Norway', group: 'I', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-22T17:00', home: 'France', away: 'Iraq', group: 'I', venue: 'Lincoln Financial Field, Filadélfia' },
    { date: '2026-06-22T15:00', home: 'Norway', away: 'Senegal', group: 'I', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-26T21:00', home: 'Norway', away: 'France', group: 'I', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-26T21:00', home: 'Senegal', away: 'Iraq', group: 'I', venue: 'BMO Field, Toronto' },
    // GRUPO J — ARG, ALG, AUT, JOR
    { date: '2026-06-16T21:00', home: 'Argentina', away: 'Algeria', group: 'J', venue: 'Arrowhead Stadium, Kansas City' },
    { date: '2026-06-17T00:00', home: 'Austria', away: 'Jordan', group: 'J', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-22T18:00', home: 'Argentina', away: 'Austria', group: 'J', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-22T21:00', home: 'Jordan', away: 'Algeria', group: 'J', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-27T17:00', home: 'Algeria', away: 'Austria', group: 'J', venue: 'Arrowhead Stadium, Kansas City' },
    { date: '2026-06-27T17:00', home: 'Jordan', away: 'Argentina', group: 'J', venue: 'AT&T Stadium, Arlington' },
    // GRUPO K — POR, COD, UZB, COL
    { date: '2026-06-17T13:00', home: 'Portugal', away: 'DR Congo', group: 'K', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-17T22:00', home: 'Uzbekistan', away: 'Colombia', group: 'K', venue: 'Estadio Banorte, México' },
    { date: '2026-06-23T13:00', home: 'Portugal', away: 'Uzbekistan', group: 'K', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-23T15:00', home: 'Colombia', away: 'DR Congo', group: 'K', venue: 'Estadio Akron, Guadalajara' },
    { date: '2026-06-27T21:00', home: 'Colombia', away: 'Portugal', group: 'K', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-06-27T21:00', home: 'DR Congo', away: 'Uzbekistan', group: 'K', venue: 'Mercedes-Benz Stadium, Atlanta' },
    // GRUPO L — ENG, CRO, GHA, PAN
    { date: '2026-06-17T16:00', home: 'England', away: 'Croatia', group: 'L', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-17T19:00', home: 'Ghana', away: 'Panama', group: 'L', venue: 'BMO Field, Toronto' },
    { date: '2026-06-23T16:00', home: 'England', away: 'Ghana', group: 'L', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-23T21:00', home: 'Panama', away: 'Croatia', group: 'L', venue: 'BMO Field, Toronto' },
    { date: '2026-06-27T15:00', home: 'Panama', away: 'England', group: 'L', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-27T15:00', home: 'Croatia', away: 'Ghana', group: 'L', venue: 'Lincoln Financial Field, Filadélfia' },
  ];

  const missing = schedule.filter(m => !byName[m.home] || !byName[m.away]).map(m => `${m.home} / ${m.away}`);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Equipas não encontradas na BD: ${missing.join(', ')}` });
  }

  const matchesData = schedule.map(m => ({
    stage: 'Group' as const,
    groupName: m.group,
    homeTeamId: byName[m.home].id,
    awayTeamId: byName[m.away].id,
    homeScore: null as null,
    awayScore: null as null,
    status: 'Scheduled',
    date: etToPt(m.date),
    venue: m.venue,
  }));

  const inserted = await db.insert(matches).values(matchesData).returning();
  res.json({ success: true, created: inserted.length, message: `${inserted.length} jogos da fase de grupos inseridos!` });
});

// POST /api/matches/seed-round-of-32 — cria os 16 jogos oficiais dos 16 avos com placeholders
router.post('/seed-round-of-32', async (_req, res) => {
  const existing = await db.select().from(matches).where(eq(matches.stage, 'Round of 32'));
  if (existing.length > 0) {
    return res.status(409).json({ error: `Já existem ${existing.length} jogos dos 16 avos.` });
  }

  // Horários já em hora de Portugal (WEST = UTC+1)
  const r32 = [
    // Dia 28/06
    { date: '2026-06-28T20:00', homeLabel: '2A', awayLabel: '2B', venue: 'SoFi Stadium, Los Angeles' },
    // Dia 29/06
    { date: '2026-06-29T18:00', homeLabel: '1C', awayLabel: '2F', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-29T21:30', homeLabel: '1E', awayLabel: '3º (A/B/C/D/F)', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-29T23:00', homeLabel: '1F', awayLabel: '2C', venue: 'Estadio BBVA, Monterrey' },
    // Dia 30/06
    { date: '2026-06-30T17:00', homeLabel: '1I', awayLabel: '3º (C/D/F/G/H)', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-30T20:00', homeLabel: '2E', awayLabel: '2I', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-30T23:00', homeLabel: '1A', awayLabel: '3º (C/E/F/H/I)', venue: 'Estadio Azteca, Cidade do México' },
    // Dia 01/07
    { date: '2026-07-01T17:00', homeLabel: '1L', awayLabel: '3º (E/H/I/J/K)', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-07-01T20:00', homeLabel: '1D', awayLabel: '3º (B/E/F/I/J)', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-07-01T23:00', homeLabel: '1G', awayLabel: '3º (A/E/H/I/J)', venue: 'Lumen Field, Seattle' },
    // Dia 02/07
    { date: '2026-07-02T20:00', homeLabel: '2K', awayLabel: '2L', venue: 'BMO Field, Toronto' },
    { date: '2026-07-02T23:00', homeLabel: '1H', awayLabel: '2J', venue: 'SoFi Stadium, Los Angeles' },
    // Dia 03/07 (alguns entram em 04/07 em hora PT)
    { date: '2026-07-03T19:00', homeLabel: '2D', awayLabel: '2G', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-07-03T23:00', homeLabel: '1J', awayLabel: '2H', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-07-04T04:00', homeLabel: '1B', awayLabel: '3º (E/F/G/I/J)', venue: 'BC Place, Vancouver' },
    // Dia 04/07 madrugada PT
    { date: '2026-07-04T02:30', homeLabel: '1K', awayLabel: '3º (D/E/I/J/L)', venue: 'Arrowhead Stadium, Kansas City' },
  ];

  // Usa equipa "TBD" como placeholder (FK obrigatório). O frontend mostra homeLabel/awayLabel.
  const allTeams = await db.select().from(teams);
  let tbd = allTeams.find((t: typeof allTeams[0]) => t.code === 'TBD');
  if (!tbd) {
    const [created] = await db.insert(teams).values({
      name: 'TBD', code: 'TBD', group: '?',
      flagUrl: '', defaultFormation: '4-4-2',
    }).returning();
    tbd = created;
  }

  const toInsert = r32.map(m => ({
    stage: 'Round of 32' as const,
    homeTeamId: tbd!.id,
    awayTeamId: tbd!.id,
    homeLabel: m.homeLabel,
    awayLabel: m.awayLabel,
    status: 'Scheduled',
    date: m.date,
    venue: m.venue,
  }));

  const inserted = await db.insert(matches).values(toInsert).returning();
  res.json({ success: true, created: inserted.length, message: `${inserted.length} jogos dos 16 avos criados com placeholders!` });
});

// POST /api/matches/seed-knockout-stages — cria oitavos, quartos, meias, bronze e final
router.post('/seed-knockout-stages', async (_req, res) => {
  const stagesToCheck = ['Round of 16', 'Quarter-Final', 'Semi-Final', 'Third Place', 'Final'];
  const existing = await db.select().from(matches)
    .where(eq(matches.stage, 'Round of 16'));
  if (existing.length > 0) {
    return res.status(409).json({ error: `Já existem ${existing.length} jogos dos oitavos.` });
  }

  const allTeams = await db.select().from(teams);
  let tbd = allTeams.find((t: typeof allTeams[0]) => t.code === 'TBD');
  if (!tbd) {
    const [created] = await db.insert(teams).values({
      name: 'TBD', code: 'TBD', group: '?',
      flagUrl: '', defaultFormation: '4-4-2',
    }).returning();
    tbd = created;
  }

  // Todos os horários em hora de Portugal (WEST = UTC+1)
  // V73 = Vencedor Jogo 73 (numeração oficial FIFA), P101 = Perdedor Jogo 101
  const knockout = [
    // OITAVOS DE FINAL (Round of 16) — jogos 89-96
    { stage: 'Round of 16', date: '2026-07-04T18:00', homeLabel: 'V73', awayLabel: 'V75', venue: 'NRG Stadium, Houston' },
    { stage: 'Round of 16', date: '2026-07-04T22:00', homeLabel: 'V74', awayLabel: 'V77', venue: 'Lincoln Financial Field, Filadélfia' },
    { stage: 'Round of 16', date: '2026-07-05T21:00', homeLabel: 'V76', awayLabel: 'V78', venue: 'MetLife Stadium, Nova Jérsia' },
    { stage: 'Round of 16', date: '2026-07-06T01:00', homeLabel: 'V79', awayLabel: 'V80', venue: 'Estadio Azteca, Cidade do México' },
    { stage: 'Round of 16', date: '2026-07-06T20:00', homeLabel: 'V83', awayLabel: 'V84', venue: 'AT&T Stadium, Arlington' },
    { stage: 'Round of 16', date: '2026-07-07T01:00', homeLabel: 'V81', awayLabel: 'V82', venue: 'Lumen Field, Seattle' },
    { stage: 'Round of 16', date: '2026-07-07T17:00', homeLabel: 'V86', awayLabel: 'V88', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { stage: 'Round of 16', date: '2026-07-07T21:00', homeLabel: 'V85', awayLabel: 'V87', venue: 'BC Place, Vancouver' },
    // QUARTOS DE FINAL (Quarter-Final) — jogos 97-100
    { stage: 'Quarter-Final', date: '2026-07-09T21:00', homeLabel: 'V89', awayLabel: 'V90', venue: 'Gillette Stadium, Foxborough' },
    { stage: 'Quarter-Final', date: '2026-07-10T20:00', homeLabel: 'V93', awayLabel: 'V94', venue: 'SoFi Stadium, Los Angeles' },
    { stage: 'Quarter-Final', date: '2026-07-11T22:00', homeLabel: 'V91', awayLabel: 'V92', venue: 'Hard Rock Stadium, Miami' },
    { stage: 'Quarter-Final', date: '2026-07-12T02:00', homeLabel: 'V95', awayLabel: 'V96', venue: 'Arrowhead Stadium, Kansas City' },
    // MEIAS-FINAIS (Semi-Final) — jogos 101-102
    { stage: 'Semi-Final', date: '2026-07-14T20:00', homeLabel: 'V97', awayLabel: 'V98', venue: 'AT&T Stadium, Arlington' },
    { stage: 'Semi-Final', date: '2026-07-15T20:00', homeLabel: 'V99', awayLabel: 'V100', venue: 'Mercedes-Benz Stadium, Atlanta' },
    // JOGO DO 3º LUGAR (Third Place) — jogo 103
    { stage: 'Third Place', date: '2026-07-18T22:00', homeLabel: 'P101', awayLabel: 'P102', venue: 'Hard Rock Stadium, Miami' },
    // FINAL — jogo 104
    { stage: 'Final', date: '2026-07-19T20:00', homeLabel: 'V101', awayLabel: 'V102', venue: 'MetLife Stadium, Nova Jérsia' },
  ];

  const toInsert = knockout.map(m => ({
    stage: m.stage,
    homeTeamId: tbd!.id,
    awayTeamId: tbd!.id,
    homeLabel: m.homeLabel,
    awayLabel: m.awayLabel,
    status: 'Scheduled',
    date: m.date,
    venue: m.venue,
  }));

  const inserted = await db.insert(matches).values(toInsert).returning();
  res.json({ success: true, created: inserted.length, message: `${inserted.length} jogos inseridos (oitavos, quartos, meias, bronze e final)!` });
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
