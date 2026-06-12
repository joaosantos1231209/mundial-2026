import { eq, and, or, sql, isNull, isNotNull } from 'drizzle-orm';
import db from '../db/index';
import { teams, players, matches, matchEvents, lineups, scraperLogs } from '../db/schema';
import { sendNotification } from './pushService';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.World';

function mapPosition(abbr: string): string {
  const a = (abbr || '').toUpperCase();
  if (a === 'G' || a === 'GK') return 'GK';
  if (a === 'D' || a === 'DF' || a === 'CB' || a === 'LB' || a === 'RB') return 'DEF';
  if (a === 'M' || a === 'MF' || a === 'CM' || a === 'CAM' || a === 'CDM') return 'MID';
  if (a === 'F' || a === 'FW' || a === 'CF' || a === 'LW' || a === 'RW' || a === 'ST') return 'FWD';
  return 'MID';
}

function mapStatus(espnStatus: string): string {
  if (espnStatus === 'STATUS_FINAL' || espnStatus === 'STATUS_FULL_TIME') return 'Finished';
  if (espnStatus === 'STATUS_IN_PROGRESS' || espnStatus === 'STATUS_HALFTIME') return 'Live';
  return 'Scheduled';
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export type SyncResult = { synced: number; errors: string[] };

async function writeLog(type: string, status: string, recordsUpdated: number, message: string, durationMs: number) {
  await db.insert(scraperLogs).values({
    runAt: new Date().toISOString(),
    type,
    status,
    recordsUpdated,
    message,
    durationMs,
  });
}

// Fuzzy name match: ignores accents and case
function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').trim();
}

function findPlayerByName(
  displayName: string,
  playerMap: Map<string, { id: number; teamId: number; name: string }>
): { id: number; teamId: number; name: string } | undefined {
  const norm = normalizeName(displayName);
  return playerMap.get(norm) || playerMap.get(norm.split(' ').at(-1) || norm);
}

export async function syncAllSquads(onProgress?: (msg: string) => void): Promise<SyncResult> {
  const start = Date.now();
  const allTeams = await db.select().from(teams);
  const teamsWithEspn = allTeams.filter(t => t.espnId);
  let synced = 0;
  const errors: string[] = [];

  for (const team of teamsWithEspn) {
    try {
      onProgress?.(`A sincronizar ${team.name}...`);
      const url = `${ESPN_BASE}/teams/${team.espnId}/roster`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (!res.ok) {
        errors.push(`${team.name}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json() as {
        athletes?: Array<{ displayName: string; jersey?: string; age?: number; position?: { abbreviation: string } }>
      };

      const athletesList = data.athletes || [];
      const existing = await db.select().from(players).where(eq(players.teamId, team.id));
      const existingByName = Object.fromEntries(existing.map(p => [normalizeName(p.name), p]));

      let added = 0;
      for (const athlete of athletesList) {
        const pos = mapPosition(athlete.position?.abbreviation || '');
        const shirtNumber = athlete.jersey ? parseInt(athlete.jersey) : null;
        const age = athlete.age || null;
        const key = normalizeName(athlete.displayName);
        const existingPlayer = existingByName[key];

        if (existingPlayer) {
          await db.update(players)
            .set({ position: pos, shirtNumber, age })
            .where(eq(players.id, existingPlayer.id));
        } else {
          await db.insert(players).values({
            name: athlete.displayName,
            teamId: team.id,
            position: pos,
            shirtNumber,
            age,
          });
          added++;
        }
      }

      synced += athletesList.length;
      onProgress?.(`✅ ${team.name}: ${athletesList.length} jogadores (${added} novos)`);
      await delay(300);
    } catch (err: any) {
      errors.push(`${team.name}: ${err.message}`);
    }
  }

  const durationMs = Date.now() - start;
  const status = errors.length === 0 ? 'success' : synced > 0 ? 'partial' : 'error';
  await writeLog('squads', status, synced, errors.slice(0, 5).join('; ') || `${synced} jogadores sincronizados`, durationMs);
  return { synced, errors };
}

export async function syncMatchStats(matchId: number, espnEventId: string): Promise<{ events: number; error?: string }> {
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${espnEventId}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { events: 0, error: `ESPN HTTP ${res.status}` };

    const data = await res.json() as {
      keyEvents?: Array<{
        type: { type: string; text: string };
        clock?: { value: number; displayValue: string };
        scoringPlay?: boolean;
        team?: { id: string; displayName: string };
        participants?: Array<{ athlete: { id: string; displayName: string } }>;
        shortText?: string;
      }>;
      rosters?: Array<{
        homeAway: string;
        team: { id: string; displayName: string };
        roster?: Array<{
          starter: boolean;
          active: boolean;
          athlete: { displayName: string };
        }>;
      }>;
    };

    const keyEvents = data.keyEvents || [];
    const rosters = data.rosters || [];

    // Carregar jogo e jogadores
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: { homeTeam: true, awayTeam: true },
    });
    if (!match) return { events: 0, error: 'Match not found' };

    const teamPlayers = await db.select().from(players).where(
      or(eq(players.teamId, match.homeTeamId), eq(players.teamId, match.awayTeamId))
    );

    const playerMap = new Map<string, { id: number; teamId: number; name: string }>();
    for (const p of teamPlayers) {
      playerMap.set(normalizeName(p.name), p);
      // Também indexar pelo apelido para fallback
      const parts = normalizeName(p.name).split(' ');
      if (parts.length > 1) playerMap.set(parts[parts.length - 1], p);
    }

    // Mapa ESPN team ID → nosso team ID
    const espnToOurTeam = new Map<string, number>();
    for (const roster of rosters) {
      const espnId = roster.team?.id;
      const name = roster.team?.displayName?.toLowerCase();
      if (name?.includes(match.homeTeam!.name.toLowerCase()) || match.homeTeam!.name.toLowerCase().includes(name || '')) {
        espnToOurTeam.set(espnId, match.homeTeamId);
      } else {
        espnToOurTeam.set(espnId, match.awayTeamId);
      }
    }

    // Guardar contagens anteriores para detectar eventos novos
    const prevEvents = await db.select().from(matchEvents).where(eq(matchEvents.matchId, matchId));
    const prevGoals = prevEvents.filter(e => e.eventType === 'Goal' || e.eventType === 'OwnGoal').length;
    const prevReds = prevEvents.filter(e => e.eventType === 'Red').length;

    // Limpar eventos anteriores deste jogo
    await db.delete(matchEvents).where(eq(matchEvents.matchId, matchId));

    const eventsToInsert: Array<{
      matchId: number; playerId: number | null; teamId: number | null;
      eventType: string; minute: number | null; description: string;
    }> = [];

    // Processar keyEvents
    for (const event of keyEvents) {
      const type = event.type?.type || '';
      const minuteRaw = event.clock?.value;
      const minute = minuteRaw ? Math.round(minuteRaw / 60) : null;
      const teamId = event.team?.id ? (espnToOurTeam.get(event.team.id) || null) : null;

      if (type.startsWith('goal')) {
        const isOwnGoal = type.includes('own-goal');
        const scorer = event.participants?.[0];
        const assister = event.participants?.[1];

        if (scorer) {
          const player = findPlayerByName(scorer.athlete.displayName, playerMap);
          eventsToInsert.push({
            matchId,
            playerId: player?.id ?? null,
            teamId: player?.teamId ?? teamId,
            eventType: isOwnGoal ? 'OwnGoal' : 'Goal',
            minute,
            description: event.shortText || scorer.athlete.displayName,
          });
        }

        if (assister && !isOwnGoal) {
          const player = findPlayerByName(assister.athlete.displayName, playerMap);
          eventsToInsert.push({
            matchId,
            playerId: player?.id ?? null,
            teamId: player?.teamId ?? teamId,
            eventType: 'Assist',
            minute,
            description: assister.athlete.displayName,
          });
        }
      }

      if (type === 'yellow-card') {
        const participant = event.participants?.[0];
        if (participant) {
          const player = findPlayerByName(participant.athlete.displayName, playerMap);
          eventsToInsert.push({
            matchId, playerId: player?.id ?? null, teamId: player?.teamId ?? teamId,
            eventType: 'Yellow', minute, description: participant.athlete.displayName,
          });
        }
      }

      if (type === 'red-card' || type === 'yellow-red-card') {
        const participant = event.participants?.[0];
        if (participant) {
          const player = findPlayerByName(participant.athlete.displayName, playerMap);
          eventsToInsert.push({
            matchId, playerId: player?.id ?? null, teamId: player?.teamId ?? teamId,
            eventType: 'Red', minute, description: participant.athlete.displayName,
          });
        }
      }
    }

    // Calcular minutos jogados a partir das substituições e titulares
    const FULL_MATCH = 90;
    const subs = keyEvents.filter(e => e.type?.type === 'substitution');

    // Mapa: nome do jogador → minuto que saiu (se foi substituído)
    const substitutedOut = new Map<string, number>(); // quem saiu
    const substitutedIn = new Map<string, number>();  // quem entrou

    for (const sub of subs) {
      const inPlayer = sub.participants?.[0];
      const outPlayer = sub.participants?.[1];
      const minute = sub.clock?.value ? Math.round(sub.clock.value / 60) : FULL_MATCH;
      if (inPlayer) substitutedIn.set(normalizeName(inPlayer.athlete.displayName), minute);
      if (outPlayer) substitutedOut.set(normalizeName(outPlayer.athlete.displayName), minute);
    }

    for (const roster of rosters) {
      const rosterPlayers = roster.roster || [];
      for (const rp of rosterPlayers) {
        const normName = normalizeName(rp.athlete.displayName);
        const player = findPlayerByName(rp.athlete.displayName, playerMap);
        if (!player || !rp.active) continue;

        let mins = 0;
        if (rp.starter) {
          // Titular: jogou até ser substituído ou até ao fim
          mins = substitutedOut.get(normName) ?? FULL_MATCH;
        } else {
          // Suplente: entrou se aparecer em substitutedIn
          const enteredAt = substitutedIn.get(normName);
          if (enteredAt !== undefined) {
            mins = FULL_MATCH - enteredAt;
          }
        }

        if (mins > 0) {
          eventsToInsert.push({
            matchId, playerId: player.id, teamId: player.teamId,
            eventType: 'minutes_played', minute: mins, description: '',
          });
        }
      }
    }

    if (eventsToInsert.length > 0) {
      await db.insert(matchEvents).values(eventsToInsert);
    }

    // Gravar onzes iniciais e suplentes na tabela lineups
    const lineupsToInsert: Array<{
      matchId: number; teamId: number; playerId: number;
      posX: number; posY: number; isStarter: number;
    }> = [];
    for (const roster of rosters) {
      for (const rp of roster.roster || []) {
        if (!rp.active) continue;
        const player = findPlayerByName(rp.athlete.displayName, playerMap);
        if (!player) continue;
        lineupsToInsert.push({
          matchId,
          teamId: player.teamId,
          playerId: player.id,
          posX: 50,
          posY: 50,
          isStarter: rp.starter ? 1 : 0,
        });
      }
    }
    if (lineupsToInsert.length > 0) {
      await db.delete(lineups).where(eq(lineups.matchId, matchId));
      await db.insert(lineups).values(lineupsToInsert);
    }

    // Notificações de novos golos e expulsões
    const matchUrl = `/matches/${matchId}`;
    const homeCode = match.homeTeam?.code ?? '?';
    const awayCode = match.awayTeam?.code ?? '?';

    const newGoals = eventsToInsert.filter(e => e.eventType === 'Goal' || e.eventType === 'OwnGoal');
    if (newGoals.length > prevGoals) {
      for (const goal of newGoals.slice(prevGoals)) {
        const scorer = goal.playerId
          ? teamPlayers.find(p => p.id === goal.playerId)
          : null;
        const scorerName = scorer?.name ?? (goal.teamId === match.homeTeamId ? match.homeTeam?.name : match.awayTeam?.name) ?? '?';
        const isOG = goal.eventType === 'OwnGoal';
        sendNotification(
          `⚽ Golo! ${homeCode} vs ${awayCode}`,
          `${scorerName}${isOG ? ' (golo próprio)' : ' marca!'}`,
          matchUrl
        ).catch(() => {});
      }
    }

    const newReds = eventsToInsert.filter(e => e.eventType === 'Red');
    if (newReds.length > prevReds) {
      for (const red of newReds.slice(prevReds)) {
        const expelled = red.playerId
          ? teamPlayers.find(p => p.id === red.playerId)
          : null;
        const expelledName = expelled?.name ?? '?';
        sendNotification(
          `🟥 Expulsão! ${homeCode} vs ${awayCode}`,
          `${expelledName} viu o cartão vermelho`,
          matchUrl
        ).catch(() => {});
      }
    }

    // Recalcular stats de todos os jogadores afetados
    const affectedPlayerIds = [...new Set(eventsToInsert.map(e => e.playerId).filter(Boolean))] as number[];
    for (const playerId of affectedPlayerIds) {
      const events = await db.select().from(matchEvents).where(eq(matchEvents.playerId, playerId));
      const goals = events.filter(e => e.eventType === 'Goal').length;
      const assists = events.filter(e => e.eventType === 'Assist').length;
      const yellowCards = events.filter(e => e.eventType === 'Yellow').length;
      const redCards = events.filter(e => e.eventType === 'Red').length;
      const minutesPlayed = events.filter(e => e.eventType === 'minutes_played').reduce((s, e) => s + (e.minute || 0), 0);

      await db.update(players)
        .set({ goals, assists, yellowCards, redCards, minutesPlayed })
        .where(eq(players.id, playerId));
    }

    return { events: eventsToInsert.length };
  } catch (err: any) {
    return { events: 0, error: err.message };
  }
}

export async function syncLiveScores(): Promise<{ updated: number; errors: string[] }> {
  const start = Date.now();
  let updated = 0;
  const errors: string[] = [];

  try {
    // Buscar hoje + ontem: jogos às 3h Portugal (UTC+1) aparecem no dia anterior em US Eastern na ESPN
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    const [res1, res2] = await Promise.all([
      fetch(`${ESPN_BASE}/scoreboard`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${ESPN_BASE}/scoreboard?dates=${yesterday}`, { signal: AbortSignal.timeout(10000) }),
    ]);
    if (!res1.ok && !res2.ok) throw new Error(`HTTP ${res1.status}`);

    type ESPNEvent = {
      id: string;
      date: string;
      competitions: Array<{
        status: { type: { name: string; displayName: string } };
        competitors: Array<{ homeAway: string; score: string; team: { id: string; displayName: string } }>;
      }>;
    };

    const seenIds = new Set<string>();
    const allEvents: ESPNEvent[] = [];
    for (const res of [res1, res2]) {
      if (!res.ok) continue;
      const data = await res.json() as { events?: ESPNEvent[] };
      for (const event of data.events || []) {
        if (!seenIds.has(event.id)) { seenIds.add(event.id); allEvents.push(event); }
      }
    }

    const allTeams = await db.select().from(teams);
    const byEspnId = Object.fromEntries(allTeams.filter(t => t.espnId).map(t => [String(t.espnId), t]));
    const byName = new Map(allTeams.map(t => [normalizeName(t.name), t]));

    async function resolveTeam(espnTeamId: string, displayName: string) {
      if (byEspnId[espnTeamId]) return byEspnId[espnTeamId];
      const match = byName.get(normalizeName(displayName))
        ?? [...byName.entries()].find(([k]) => k.includes(normalizeName(displayName)) || normalizeName(displayName).includes(k))?.[1];
      if (match && !match.espnId) {
        const espnIdNum = parseInt(espnTeamId);
        await db.update(teams).set({ espnId: espnIdNum }).where(eq(teams.id, match.id));
        match.espnId = espnIdNum;
        byEspnId[espnTeamId] = match;
        console.log(`[ScoreSync] ESPN ID ${espnTeamId} → ${match.name}`);
      }
      return match;
    }

    for (const event of allEvents) {
      try {
        const comp = event.competitions[0];
        const homeComp = comp.competitors.find(c => c.homeAway === 'home');
        const awayComp = comp.competitors.find(c => c.homeAway === 'away');
        if (!homeComp || !awayComp) continue;

        const homeTeam = await resolveTeam(homeComp.team.id, homeComp.team.displayName);
        const awayTeam = await resolveTeam(awayComp.team.id, awayComp.team.displayName);
        if (!homeTeam || !awayTeam) {
          console.warn(`[ScoreSync] Equipas não encontradas: ${homeComp.team.displayName} vs ${awayComp.team.displayName}`);
          continue;
        }

        const newStatus = mapStatus(comp.status.type.name);
        const homeScore = parseInt(homeComp.score) || 0;
        const awayScore = parseInt(awayComp.score) || 0;

        const match = await db.query.matches.findFirst({
          where: and(eq(matches.homeTeamId, homeTeam.id), eq(matches.awayTeamId, awayTeam.id)),
        });

        if (match) {
          const prevStatus = match.status;
          const prevHome = match.homeScore ?? 0;
          const prevAway = match.awayScore ?? 0;
          const updateData: Partial<typeof matches.$inferInsert> = {
            status: newStatus,
            espnEventId: event.id,
          };
          if (newStatus === 'Finished' || newStatus === 'Live') {
            updateData.homeScore = homeScore;
            updateData.awayScore = awayScore;
          }
          await db.update(matches).set(updateData).where(eq(matches.id, match.id));

          if (newStatus === 'Finished' && match.stage === 'Group' && match.groupName) {
            await recalculateGroup(match.groupName);
          }

          // Sync stats quando jogo está ao vivo ou acabou de terminar
          if (newStatus === 'Live' || (newStatus === 'Finished' && prevStatus !== 'Finished')) {
            syncMatchStats(match.id, event.id).catch(err =>
              console.error(`[AutoSync] Stats error for match ${match.id}:`, err.message)
            );
          }

          // Push notifications (golos e expulsões são enviados dentro de syncMatchStats)
          const ht = homeTeam.name;
          const at = awayTeam.name;
          const matchUrl = `/matches/${match.id}`;
          if (prevStatus === 'Scheduled' && newStatus === 'Live') {
            sendNotification(`⚽ Jogo iniciado!`, `${ht} vs ${at} — O jogo começou!`, matchUrl).catch(() => {});
          } else if (newStatus === 'Finished' && prevStatus !== 'Finished') {
            sendNotification(`🏁 Jogo terminado`, `${ht} ${homeScore}–${awayScore} ${at}`, matchUrl).catch(() => {});
          }

          updated++;
        }
      } catch (e: any) {
        errors.push(e.message);
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  const durationMs = Date.now() - start;
  const status = errors.length === 0 ? 'success' : updated > 0 ? 'partial' : 'error';
  await writeLog('scores', status, updated, errors.slice(0, 5).join('; ') || `${updated} jogos actualizados`, durationMs);
  return { updated, errors };
}

export async function syncUpcomingIds(): Promise<{ filled: number; errors: string[] }> {
  const errors: string[] = [];
  let filled = 0;

  try {
    const scheduledMatches = await db.select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      date: matches.date,
      espnEventId: matches.espnEventId,
    }).from(matches)
      .where(and(eq(matches.status, 'Scheduled'), isNull(matches.espnEventId)));

    if (scheduledMatches.length === 0) return { filled: 0, errors: [] };

    const allTeams = await db.select().from(teams);
    const byEspnId = Object.fromEntries(allTeams.filter(t => t.espnId).map(t => [String(t.espnId), t]));
    const byId = Object.fromEntries(allTeams.map(t => [t.id, t]));

    // Fetch ESPN by unique dates (up to 14 days out)
    const uniqueDates = [...new Set(scheduledMatches.flatMap(m => espnDateRange(m.date)))].slice(0, 20);

    for (const dateStr of uniqueDates) {
      try {
        const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${dateStr}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;

        const data = await res.json() as {
          events?: Array<{
            id: string;
            competitions: Array<{
              competitors: Array<{ homeAway: string; team: { id: string } }>;
            }>;
          }>;
        };

        for (const event of data.events || []) {
          const comp = event.competitions[0];
          const homeComp = comp.competitors.find(c => c.homeAway === 'home');
          const awayComp = comp.competitors.find(c => c.homeAway === 'away');
          if (!homeComp || !awayComp) continue;

          const homeTeam = byEspnId[homeComp.team.id];
          const awayTeam = byEspnId[awayComp.team.id];
          if (!homeTeam || !awayTeam) continue;

          const match = scheduledMatches.find(m =>
            m.homeTeamId === homeTeam.id && m.awayTeamId === awayTeam.id && !m.espnEventId
          );
          if (match) {
            await db.update(matches).set({ espnEventId: event.id }).where(eq(matches.id, match.id));
            match.espnEventId = event.id;
            filled++;
            console.log(`[IDSync] ${byId[match.homeTeamId]?.code ?? '?'} vs ${byId[match.awayTeamId]?.code ?? '?'} → ESPN ${event.id}`);
          }
        }

        await delay(300);
      } catch (e: any) {
        errors.push(`Date ${dateStr}: ${e.message}`);
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  return { filled, errors };
}

// Devolve o dia e o dia anterior de uma data (YYYYMMDD).
// Usado para cobrir jogos de madrugada em Portugal que na ESPN aparecem no dia anterior (UTC).
function espnDateRange(dateStr: string): [string, string] {
  const day = dateStr.split('T')[0].replace(/-/g, '');
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const prev = d.toISOString().slice(0, 10).replace(/-/g, '');
  return [prev, day];
}

function normalizeVenue(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function venueMatches(ourVenue: string, espnVenue: string): boolean {
  const a = normalizeVenue(ourVenue);
  const b = normalizeVenue(espnVenue);
  return a.includes(b) || b.includes(a);
}

export async function syncKnockoutTeams(): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  try {
    // Jogos de knockout que ainda têm labels (TBD)
    const labelMatches = await db.select({
      id: matches.id,
      homeLabel: matches.homeLabel,
      awayLabel: matches.awayLabel,
      date: matches.date,
      venue: matches.venue,
      espnEventId: matches.espnEventId,
    }).from(matches)
      .where(or(isNotNull(matches.homeLabel), isNotNull(matches.awayLabel)));

    if (labelMatches.length === 0) return { updated: 0, errors: [] };

    const allTeams = await db.select().from(teams);
    const byEspnId = Object.fromEntries(allTeams.filter(t => t.espnId).map(t => [String(t.espnId), t]));

    const remaining = [...labelMatches];

    // Fase 1: para jogos sem espnEventId, tentar encontrar por venue + dia
    const withoutId = remaining.filter(m => !m.espnEventId);
    const uniqueDates = [...new Set(withoutId.flatMap(m => espnDateRange(m.date)))].slice(0, 20);

    for (const dateStr of uniqueDates) {
      try {
        const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${dateStr}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;

        const data = await res.json() as {
          events?: Array<{
            id: string;
            competitions: Array<{
              venue?: { fullName?: string };
              competitors: Array<{ homeAway: string; team: { id: string } }>;
            }>;
          }>;
        };

        for (const event of data.events || []) {
          const comp = event.competitions[0];
          const espnVenueName = comp.venue?.fullName ?? '';

          const idx = withoutId.findIndex(m =>
            m.venue && espnVenueName && venueMatches(m.venue, espnVenueName)
          );
          if (idx === -1) continue;

          const match = withoutId[idx];
          await db.update(matches).set({ espnEventId: event.id }).where(eq(matches.id, match.id));
          match.espnEventId = event.id;
          // Reflectir também no array remaining
          const ri = remaining.findIndex(m => m.id === match.id);
          if (ri !== -1) remaining[ri].espnEventId = event.id;
          withoutId.splice(idx, 1);
          console.log(`[KnockoutSync] Jogo ${match.id} → ESPN ID ${event.id} (venue match)`);
        }

        await delay(300);
      } catch (e: any) {
        errors.push(`Date ${dateStr}: ${e.message}`);
      }
    }

    // Fase 2: para todos os que já têm espnEventId, verificar se a ESPN já tem equipas reais
    const withId = remaining.filter(m => m.espnEventId);

    for (const match of withId) {
      try {
        const res = await fetch(`${ESPN_BASE}/summary?event=${match.espnEventId}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;

        const data = await res.json() as {
          boxscore?: {
            teams?: Array<{ homeAway: string; team: { id: string } }>;
          };
        };

        const competitors = data.boxscore?.teams ?? [];
        const homeComp = competitors.find(c => c.homeAway === 'home');
        const awayComp = competitors.find(c => c.homeAway === 'away');
        if (!homeComp || !awayComp) continue;

        const homeTeam = byEspnId[homeComp.team.id];
        const awayTeam = byEspnId[awayComp.team.id];
        if (!homeTeam || !awayTeam || homeTeam.code === 'TBD' || awayTeam.code === 'TBD') continue;

        await db.update(matches)
          .set({ homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, homeLabel: null, awayLabel: null })
          .where(eq(matches.id, match.id));

        updated++;
        console.log(`[KnockoutSync] Jogo ${match.id}: ${homeTeam.code} vs ${awayTeam.code} preenchido`);
        await delay(200);
      } catch (e: any) {
        errors.push(`Event ${match.espnEventId}: ${e.message}`);
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  return { updated, errors };
}

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
    const hs = m.homeScore!; const as_ = m.awayScore!;
    if (!stats[m.homeTeamId] || !stats[m.awayTeamId]) continue;
    stats[m.homeTeamId].gf += hs; stats[m.homeTeamId].ga += as_;
    stats[m.awayTeamId].gf += as_; stats[m.awayTeamId].ga += hs;
    if (hs > as_) { stats[m.homeTeamId].w++; stats[m.homeTeamId].pts += 3; stats[m.awayTeamId].l++; }
    else if (hs === as_) { stats[m.homeTeamId].d++; stats[m.homeTeamId].pts++; stats[m.awayTeamId].d++; stats[m.awayTeamId].pts++; }
    else { stats[m.awayTeamId].w++; stats[m.awayTeamId].pts += 3; stats[m.homeTeamId].l++; }
  }

  for (const [id, s] of Object.entries(stats)) {
    await db.update(teams)
      .set({ wins: s.w, draws: s.d, losses: s.l, goalsFor: s.gf, goalsAgainst: s.ga, points: s.pts })
      .where(eq(teams.id, Number(id)));
  }
}
