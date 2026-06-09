import { eq, and } from 'drizzle-orm';
import db from './index';
import { matchEvents, matches, players, teams } from './schema';

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

async function seed() {
  console.log('🌱 A iniciar seed com dados reais do Mundial 2026...');

  await db.delete(matchEvents);
  await db.delete(matches);
  await db.delete(players);
  await db.delete(teams);

  // --- EQUIPAS REAIS (grupos oficiais do sorteio de Dezembro 2025) ---
  const teamsData = [
    // Grupo A (sede: México)
    { name: 'Mexico', code: 'MEX', group: 'A', flagUrl: 'https://flagcdn.com/mx.svg', defaultFormation: '4-3-3', espnId: 203 },
    { name: 'South Africa', code: 'RSA', group: 'A', flagUrl: 'https://flagcdn.com/za.svg', defaultFormation: '4-4-2', espnId: 467 },
    { name: 'South Korea', code: 'KOR', group: 'A', flagUrl: 'https://flagcdn.com/kr.svg', defaultFormation: '4-3-3', espnId: 451 },
    { name: 'Czechia', code: 'CZE', group: 'A', flagUrl: 'https://flagcdn.com/cz.svg', defaultFormation: '4-2-3-1', espnId: 450 },
    // Grupo B (sede: Canadá/EUA)
    { name: 'Canada', code: 'CAN', group: 'B', flagUrl: 'https://flagcdn.com/ca.svg', defaultFormation: '4-3-3', espnId: 206 },
    { name: 'Bosnia-Herzegovina', code: 'BIH', group: 'B', flagUrl: 'https://flagcdn.com/ba.svg', defaultFormation: '4-3-3', espnId: 452 },
    { name: 'Qatar', code: 'QAT', group: 'B', flagUrl: 'https://flagcdn.com/qa.svg', defaultFormation: '4-3-3', espnId: 4398 },
    { name: 'Switzerland', code: 'SUI', group: 'B', flagUrl: 'https://flagcdn.com/ch.svg', defaultFormation: '3-4-3', espnId: 475 },
    // Grupo C
    { name: 'Brazil', code: 'BRA', group: 'C', flagUrl: 'https://flagcdn.com/br.svg', defaultFormation: '4-2-3-1', espnId: 205 },
    { name: 'Morocco', code: 'MAR', group: 'C', flagUrl: 'https://flagcdn.com/ma.svg', defaultFormation: '4-3-3', espnId: 2869 },
    { name: 'Haiti', code: 'HAI', group: 'C', flagUrl: 'https://flagcdn.com/ht.svg', defaultFormation: '4-4-2', espnId: 2654 },
    { name: 'Scotland', code: 'SCO', group: 'C', flagUrl: 'https://flagcdn.com/gb-sct.svg', defaultFormation: '4-3-3', espnId: 580 },
    // Grupo D (sede: EUA)
    { name: 'United States', code: 'USA', group: 'D', flagUrl: 'https://flagcdn.com/us.svg', defaultFormation: '4-3-3', espnId: 660 },
    { name: 'Paraguay', code: 'PAR', group: 'D', flagUrl: 'https://flagcdn.com/py.svg', defaultFormation: '4-4-2', espnId: 210 },
    { name: 'Australia', code: 'AUS', group: 'D', flagUrl: 'https://flagcdn.com/au.svg', defaultFormation: '4-3-3', espnId: 628 },
    { name: 'Türkiye', code: 'TUR', group: 'D', flagUrl: 'https://flagcdn.com/tr.svg', defaultFormation: '4-2-3-1', espnId: 465 },
    // Grupo E
    { name: 'Germany', code: 'GER', group: 'E', flagUrl: 'https://flagcdn.com/de.svg', defaultFormation: '4-3-3', espnId: 481 },
    { name: 'Curaçao', code: 'CUW', group: 'E', flagUrl: 'https://flagcdn.com/cw.svg', defaultFormation: '4-4-2', espnId: 11678 },
    { name: 'Ivory Coast', code: 'CIV', group: 'E', flagUrl: 'https://flagcdn.com/ci.svg', defaultFormation: '4-3-3', espnId: 4789 },
    { name: 'Ecuador', code: 'ECU', group: 'E', flagUrl: 'https://flagcdn.com/ec.svg', defaultFormation: '4-4-2', espnId: 209 },
    // Grupo F
    { name: 'Netherlands', code: 'NED', group: 'F', flagUrl: 'https://flagcdn.com/nl.svg', defaultFormation: '4-3-3', espnId: 449 },
    { name: 'Japan', code: 'JPN', group: 'F', flagUrl: 'https://flagcdn.com/jp.svg', defaultFormation: '4-2-3-1', espnId: 627 },
    { name: 'Sweden', code: 'SWE', group: 'F', flagUrl: 'https://flagcdn.com/se.svg', defaultFormation: '4-4-2', espnId: 466 },
    { name: 'Tunisia', code: 'TUN', group: 'F', flagUrl: 'https://flagcdn.com/tn.svg', defaultFormation: '4-3-3', espnId: 659 },
    // Grupo G
    { name: 'Belgium', code: 'BEL', group: 'G', flagUrl: 'https://flagcdn.com/be.svg', defaultFormation: '3-4-3', espnId: 459 },
    { name: 'Egypt', code: 'EGY', group: 'G', flagUrl: 'https://flagcdn.com/eg.svg', defaultFormation: '4-2-3-1', espnId: 2620 },
    { name: 'Iran', code: 'IRN', group: 'G', flagUrl: 'https://flagcdn.com/ir.svg', defaultFormation: '4-4-2', espnId: 469 },
    { name: 'New Zealand', code: 'NZL', group: 'G', flagUrl: 'https://flagcdn.com/nz.svg', defaultFormation: '4-3-3', espnId: 2666 },
    // Grupo H
    { name: 'Spain', code: 'ESP', group: 'H', flagUrl: 'https://flagcdn.com/es.svg', defaultFormation: '4-3-3', espnId: 164 },
    { name: 'Cape Verde', code: 'CPV', group: 'H', flagUrl: 'https://flagcdn.com/cv.svg', defaultFormation: '4-3-3', espnId: 2597 },
    { name: 'Saudi Arabia', code: 'KSA', group: 'H', flagUrl: 'https://flagcdn.com/sa.svg', defaultFormation: '4-4-2', espnId: 655 },
    { name: 'Uruguay', code: 'URU', group: 'H', flagUrl: 'https://flagcdn.com/uy.svg', defaultFormation: '4-4-2', espnId: 212 },
    // Grupo I
    { name: 'France', code: 'FRA', group: 'I', flagUrl: 'https://flagcdn.com/fr.svg', defaultFormation: '4-3-3', espnId: 478 },
    { name: 'Senegal', code: 'SEN', group: 'I', flagUrl: 'https://flagcdn.com/sn.svg', defaultFormation: '4-3-3', espnId: 654 },
    { name: 'Iraq', code: 'IRQ', group: 'I', flagUrl: 'https://flagcdn.com/iq.svg', defaultFormation: '4-3-3', espnId: 4375 },
    { name: 'Norway', code: 'NOR', group: 'I', flagUrl: 'https://flagcdn.com/no.svg', defaultFormation: '4-3-3', espnId: 464 },
    // Grupo J
    { name: 'Argentina', code: 'ARG', group: 'J', flagUrl: 'https://flagcdn.com/ar.svg', defaultFormation: '4-3-3', espnId: 202 },
    { name: 'Algeria', code: 'ALG', group: 'J', flagUrl: 'https://flagcdn.com/dz.svg', defaultFormation: '4-3-3', espnId: 624 },
    { name: 'Austria', code: 'AUT', group: 'J', flagUrl: 'https://flagcdn.com/at.svg', defaultFormation: '4-2-3-1', espnId: 474 },
    { name: 'Jordan', code: 'JOR', group: 'J', flagUrl: 'https://flagcdn.com/jo.svg', defaultFormation: '4-4-2', espnId: 2917 },
    // Grupo K
    { name: 'Portugal', code: 'POR', group: 'K', flagUrl: 'https://flagcdn.com/pt.svg', defaultFormation: '4-3-3', espnId: 482 },
    { name: 'DR Congo', code: 'COD', group: 'K', flagUrl: 'https://flagcdn.com/cd.svg', defaultFormation: '4-4-2', espnId: 2850 },
    { name: 'Uzbekistan', code: 'UZB', group: 'K', flagUrl: 'https://flagcdn.com/uz.svg', defaultFormation: '4-4-2', espnId: 2570 },
    { name: 'Colombia', code: 'COL', group: 'K', flagUrl: 'https://flagcdn.com/co.svg', defaultFormation: '4-4-2', espnId: 208 },
    // Grupo L
    { name: 'England', code: 'ENG', group: 'L', flagUrl: 'https://flagcdn.com/gb-eng.svg', defaultFormation: '4-3-3', espnId: 448 },
    { name: 'Croatia', code: 'CRO', group: 'L', flagUrl: 'https://flagcdn.com/hr.svg', defaultFormation: '4-3-3', espnId: 477 },
    { name: 'Ghana', code: 'GHA', group: 'L', flagUrl: 'https://flagcdn.com/gh.svg', defaultFormation: '4-4-2', espnId: 4469 },
    { name: 'Panama', code: 'PAN', group: 'L', flagUrl: 'https://flagcdn.com/pa.svg', defaultFormation: '4-4-2', espnId: 2659 },
  ];

  const insertedTeams = await db.insert(teams).values(teamsData).returning();
  const byName = Object.fromEntries(insertedTeams.map(t => [t.name, t]));
  console.log(`✅ ${insertedTeams.length} equipas inseridas (grupos oficiais 2026)`);

  // --- CALENDÁRIO REAL (fonte: openfootball/worldcup.json) ---
  const schedule = [
    // Grupo A
    { date: '2026-06-11T21:00', home: 'Mexico', away: 'South Africa', group: 'A', venue: 'Estadio Banorte, México' },
    { date: '2026-06-11T15:00', home: 'South Korea', away: 'Czechia', group: 'A', venue: 'Estadio Akron, Guadalajara' },
    { date: '2026-06-18T12:00', home: 'Czechia', away: 'South Africa', group: 'A', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-06-18T15:00', home: 'Mexico', away: 'South Korea', group: 'A', venue: 'Estadio Akron, Guadalajara' },
    { date: '2026-06-24T17:00', home: 'Czechia', away: 'Mexico', group: 'A', venue: 'Estadio Banorte, México' },
    { date: '2026-06-24T17:00', home: 'South Africa', away: 'South Korea', group: 'A', venue: 'Estadio BBVA, Monterrey' },
    // Grupo B
    { date: '2026-06-12T15:00', home: 'Canada', away: 'Bosnia-Herzegovina', group: 'B', venue: 'BMO Field, Toronto' },
    { date: '2026-06-13T21:00', home: 'Qatar', away: 'Switzerland', group: 'B', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-18T18:00', home: 'Switzerland', away: 'Bosnia-Herzegovina', group: 'B', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-18T21:00', home: 'Canada', away: 'Qatar', group: 'B', venue: 'BC Place, Vancouver' },
    { date: '2026-06-24T21:00', home: 'Switzerland', away: 'Canada', group: 'B', venue: 'BC Place, Vancouver' },
    { date: '2026-06-24T21:00', home: 'Bosnia-Herzegovina', away: 'Qatar', group: 'B', venue: 'Lumen Field, Seattle' },
    // Grupo C
    { date: '2026-06-13T12:00', home: 'Brazil', away: 'Morocco', group: 'C', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-13T15:00', home: 'Haiti', away: 'Scotland', group: 'C', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-19T12:00', home: 'Scotland', away: 'Morocco', group: 'C', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-19T15:00', home: 'Brazil', away: 'Haiti', group: 'C', venue: 'Lincoln Financial Field, Filadélfia' },
    { date: '2026-06-24T17:00', home: 'Scotland', away: 'Brazil', group: 'C', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-06-24T17:00', home: 'Morocco', away: 'Haiti', group: 'C', venue: 'Mercedes-Benz Stadium, Atlanta' },
    // Grupo D
    { date: '2026-06-12T21:00', home: 'United States', away: 'Paraguay', group: 'D', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-13T18:00', home: 'Australia', away: 'Türkiye', group: 'D', venue: 'BC Place, Vancouver' },
    { date: '2026-06-19T18:00', home: 'United States', away: 'Australia', group: 'D', venue: 'Lumen Field, Seattle' },
    { date: '2026-06-19T21:00', home: 'Türkiye', away: 'Paraguay', group: 'D', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-25T17:00', home: 'Türkiye', away: 'United States', group: 'D', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-25T17:00', home: 'Paraguay', away: 'Australia', group: 'D', venue: "Levi's Stadium, Santa Clara" },
    // Grupo E
    { date: '2026-06-14T12:00', home: 'Germany', away: 'Curaçao', group: 'E', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-14T15:00', home: 'Ivory Coast', away: 'Ecuador', group: 'E', venue: 'Lincoln Financial Field, Filadélfia' },
    { date: '2026-06-20T12:00', home: 'Germany', away: 'Ivory Coast', group: 'E', venue: 'BMO Field, Toronto' },
    { date: '2026-06-20T15:00', home: 'Ecuador', away: 'Curaçao', group: 'E', venue: 'Arrowhead Stadium, Kansas City' },
    { date: '2026-06-25T17:00', home: 'Curaçao', away: 'Ivory Coast', group: 'E', venue: 'Lincoln Financial Field, Filadélfia' },
    { date: '2026-06-25T17:00', home: 'Ecuador', away: 'Germany', group: 'E', venue: 'MetLife Stadium, Nova Jérsia' },
    // Grupo F
    { date: '2026-06-14T18:00', home: 'Netherlands', away: 'Japan', group: 'F', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-14T21:00', home: 'Sweden', away: 'Tunisia', group: 'F', venue: 'Estadio BBVA, Monterrey' },
    { date: '2026-06-20T18:00', home: 'Netherlands', away: 'Sweden', group: 'F', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-20T21:00', home: 'Tunisia', away: 'Japan', group: 'F', venue: 'Estadio BBVA, Monterrey' },
    { date: '2026-06-25T21:00', home: 'Japan', away: 'Sweden', group: 'F', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-25T21:00', home: 'Tunisia', away: 'Netherlands', group: 'F', venue: 'Arrowhead Stadium, Kansas City' },
    // Grupo G
    { date: '2026-06-15T12:00', home: 'Belgium', away: 'Egypt', group: 'G', venue: 'Lumen Field, Seattle' },
    { date: '2026-06-15T15:00', home: 'Iran', away: 'New Zealand', group: 'G', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-21T12:00', home: 'Belgium', away: 'Iran', group: 'G', venue: 'SoFi Stadium, Los Angeles' },
    { date: '2026-06-21T15:00', home: 'New Zealand', away: 'Egypt', group: 'G', venue: 'BC Place, Vancouver' },
    { date: '2026-06-26T17:00', home: 'Egypt', away: 'Iran', group: 'G', venue: 'Lumen Field, Seattle' },
    { date: '2026-06-26T17:00', home: 'New Zealand', away: 'Belgium', group: 'G', venue: 'BC Place, Vancouver' },
    // Grupo H
    { date: '2026-06-15T18:00', home: 'Spain', away: 'Cape Verde', group: 'H', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-06-15T21:00', home: 'Saudi Arabia', away: 'Uruguay', group: 'H', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-06-21T18:00', home: 'Spain', away: 'Saudi Arabia', group: 'H', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { date: '2026-06-21T21:00', home: 'Uruguay', away: 'Cape Verde', group: 'H', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-06-26T17:00', home: 'Cape Verde', away: 'Saudi Arabia', group: 'H', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-26T17:00', home: 'Uruguay', away: 'Spain', group: 'H', venue: 'Estadio Akron, Guadalajara' },
    // Grupo I
    { date: '2026-06-16T12:00', home: 'France', away: 'Senegal', group: 'I', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-16T15:00', home: 'Iraq', away: 'Norway', group: 'I', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-22T12:00', home: 'France', away: 'Iraq', group: 'I', venue: 'Lincoln Financial Field, Filadélfia' },
    { date: '2026-06-22T15:00', home: 'Norway', away: 'Senegal', group: 'I', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-26T21:00', home: 'Norway', away: 'France', group: 'I', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-26T21:00', home: 'Senegal', away: 'Iraq', group: 'I', venue: 'BMO Field, Toronto' },
    // Grupo J
    { date: '2026-06-16T18:00', home: 'Argentina', away: 'Algeria', group: 'J', venue: 'Arrowhead Stadium, Kansas City' },
    { date: '2026-06-16T21:00', home: 'Austria', away: 'Jordan', group: 'J', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-22T18:00', home: 'Argentina', away: 'Austria', group: 'J', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-22T21:00', home: 'Jordan', away: 'Algeria', group: 'J', venue: "Levi's Stadium, Santa Clara" },
    { date: '2026-06-27T17:00', home: 'Algeria', away: 'Austria', group: 'J', venue: 'Arrowhead Stadium, Kansas City' },
    { date: '2026-06-27T17:00', home: 'Jordan', away: 'Argentina', group: 'J', venue: 'AT&T Stadium, Arlington' },
    // Grupo K
    { date: '2026-06-17T12:00', home: 'Portugal', away: 'DR Congo', group: 'K', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-17T15:00', home: 'Uzbekistan', away: 'Colombia', group: 'K', venue: 'Estadio Banorte, México' },
    { date: '2026-06-23T12:00', home: 'Portugal', away: 'Uzbekistan', group: 'K', venue: 'NRG Stadium, Houston' },
    { date: '2026-06-23T15:00', home: 'Colombia', away: 'DR Congo', group: 'K', venue: 'Estadio Akron, Guadalajara' },
    { date: '2026-06-27T17:00', home: 'Colombia', away: 'Portugal', group: 'K', venue: 'Hard Rock Stadium, Miami' },
    { date: '2026-06-27T17:00', home: 'DR Congo', away: 'Uzbekistan', group: 'K', venue: 'Mercedes-Benz Stadium, Atlanta' },
    // Grupo L
    { date: '2026-06-17T18:00', home: 'England', away: 'Croatia', group: 'L', venue: 'AT&T Stadium, Arlington' },
    { date: '2026-06-17T21:00', home: 'Ghana', away: 'Panama', group: 'L', venue: 'BMO Field, Toronto' },
    { date: '2026-06-23T18:00', home: 'England', away: 'Ghana', group: 'L', venue: 'Gillette Stadium, Foxborough' },
    { date: '2026-06-23T21:00', home: 'Panama', away: 'Croatia', group: 'L', venue: 'BMO Field, Toronto' },
    { date: '2026-06-27T21:00', home: 'Panama', away: 'England', group: 'L', venue: 'MetLife Stadium, Nova Jérsia' },
    { date: '2026-06-27T21:00', home: 'Croatia', away: 'Ghana', group: 'L', venue: 'Lincoln Financial Field, Filadélfia' },
  ];

  // Converte hora ET (UTC-4) para hora de Portugal WEST (UTC+1) = ET + 5h
  function etToPt(etDatetime: string): string {
    const [datePart, timePart] = etDatetime.split('T');
    const h = parseInt(timePart.split(':')[0]);
    const min = timePart.split(':')[1];
    const ptH = h + 5;
    if (ptH < 24) return `${datePart}T${String(ptH).padStart(2, '0')}:${min}`;
    const d = new Date(datePart + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return `${d.toISOString().split('T')[0]}T${String(ptH - 24).padStart(2, '0')}:${min}`;
  }

  const matchesData = schedule.map(m => ({
    stage: 'Group',
    groupName: m.group,
    homeTeamId: byName[m.home].id,
    awayTeamId: byName[m.away].id,
    homeScore: null,
    awayScore: null,
    status: 'Scheduled',
    date: etToPt(m.date),
    venue: m.venue,
  }));

  const insertedMatches = await db.insert(matches).values(matchesData).returning();
  console.log(`✅ ${insertedMatches.length} jogos inseridos (calendário oficial)`);
  console.log('\n🏆 Seed concluído!');
  console.log('   ⚽ 48 equipas | 12 grupos | 72 jogos da fase de grupos');
  console.log('   👉 Usa o painel Admin na app para sincronizar os plantéis da ESPN');
}

seed().catch(console.error).finally(() => process.exit(0));
