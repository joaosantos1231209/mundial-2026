import type { EfficiencyTeam, GroupStandings, LineupPlayer, Match, MatchEvent, Player, ScraperLog, StatsOverview, Team, TeamRadar, TeamStat } from '../types';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro na API');
  }
  return res.json();
}

// Teams
export const getTeams = () => request<Team[]>('/teams');
export const getTeam = (id: number) => request<Team>(`/teams/${id}`);
export const createTeam = (data: Partial<Team>) => request<Team>('/teams', { method: 'POST', body: JSON.stringify(data) });
export const updateTeam = (id: number, data: Partial<Team>) => request<Team>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// Players
export const getPlayers = (teamId?: number) => request<Player[]>(`/players${teamId ? `?teamId=${teamId}` : ''}`);
export const getPlayer = (id: number) => request<Player>(`/players/${id}`);
export const getPlayerHistory = (id: number) => request<{ player: Player; history: any[] }>(`/players/${id}/history`);
export const createPlayer = (data: Partial<Player>) => request<Player>('/players', { method: 'POST', body: JSON.stringify(data) });
export const updatePlayer = (id: number, data: Partial<Player>) => request<Player>(`/players/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deletePlayer = (id: number) => request<{ success: boolean }>(`/players/${id}`, { method: 'DELETE' });

// Matches
export const getMatches = (params?: { group?: string; stage?: string; status?: string }) => {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return request<Match[]>(`/matches${q ? `?${q}` : ''}`);
};
export const getMatch = (id: number) => request<Match>(`/matches/${id}`);
export const createMatch = (data: Partial<Match>) => request<Match>('/matches', { method: 'POST', body: JSON.stringify(data) });
export const updateMatchResult = (id: number, data: { homeScore?: number; awayScore?: number; status?: string; motmPlayerId?: number | null }) =>
  request<Match>(`/matches/${id}/result`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateMatchSchedule = (id: number, date: string) =>
  request<Match>(`/matches/${id}/schedule`, { method: 'PATCH', body: JSON.stringify({ date }) });
export const addMatchEvent = (matchId: number, data: Partial<MatchEvent>) =>
  request<MatchEvent>(`/matches/${matchId}/events`, { method: 'POST', body: JSON.stringify(data) });
export const deleteMatchEvent = (matchId: number, eventId: number) =>
  request<{ success: boolean }>(`/matches/${matchId}/events/${eventId}`, { method: 'DELETE' });

// Stats
export const getTopScorers = (limit = 20) => request<Player[]>(`/stats/top-scorers?limit=${limit}`);
export const getTopAssists = (limit = 20) => request<Player[]>(`/stats/top-assists?limit=${limit}`);
export const getCleanSheets = (limit = 20) => request<Player[]>(`/stats/clean-sheets?limit=${limit}`);
export const getGroupStandings = () => request<GroupStandings>('/stats/groups');
export const getStatsOverview = () => request<StatsOverview>('/stats/overview');
export const getGoalsByMinute = () => request<Array<{ period: string; goals: number }>>('/stats/goals-by-minute');
export const getTeamRadar = (teamId: number) => request<TeamRadar>(`/stats/radar/${teamId}`);
export const getEfficiencyStats = () => request<EfficiencyTeam[]>('/stats/efficiency');

// Lineups
export const getLineup = (matchId: number, teamId: number) => request<LineupPlayer[]>(`/lineups/${matchId}/${teamId}`);
export const saveLineup = (matchId: number, teamId: number, players: Array<{ playerId: number; posX: number; posY: number; isStarter?: boolean }>) =>
  request<LineupPlayer[]>('/lineups', { method: 'POST', body: JSON.stringify({ matchId, teamId, players }) });

// Simulate
export const simulateGroup = (groupName: string, simResults: Array<{ matchId: number; homeScore: number; awayScore: number }>) =>
  request<{ standings: TeamStat[]; matches: any[] }>(`/simulate/group/${groupName}`, { method: 'POST', body: JSON.stringify({ simResults }) });
export const getBestThirds = () => request<TeamStat[]>('/simulate/best-thirds');

// Health / Scraper logs
export const getScraperLogs = () => request<ScraperLog[]>('/health/logs');
export const downloadBackup = () => window.open(`${BASE}/health/backup`, '_blank');

// Sync
export const syncScores = () => request<{ updated: number; errors: string[] }>('/sync/scores', { method: 'POST' });
export const syncMatchStats = (matchId: number) => request<{ events: number; error?: string }>(`/sync/stats/${matchId}`, { method: 'POST' });
export const generateKnockout = () => request<{ success: boolean; created: number; message: string }>('/matches/generate-knockout', { method: 'POST' });

// Push notifications
export const getVapidPublicKey = () => request<{ publicKey: string }>('/push/vapid-public-key');
export const subscribePush = (sub: { endpoint: string; p256dh: string; auth: string }) =>
  request<{ success: boolean }>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
export const unsubscribePush = (endpoint: string) =>
  request<{ success: boolean }>('/push/unsubscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
export const testPush = () => request<{ success: boolean }>('/push/test', { method: 'POST' });

// ESPN live match data
export const getMatchEspnData = (matchId: number) => request<{
  homeTeam: { id: number; name: string; flagUrl: string };
  awayTeam: { id: number; name: string; flagUrl: string };
  lineups: Array<{
    homeAway: 'home' | 'away';
    formation: string;
    starters: Array<{ name: string; jersey: string; position: string; formationPlace: number; subbedOut: boolean; stats: Record<string, string> }>;
    bench: Array<{ name: string; jersey: string; position: string; subbedIn: boolean }>;
  }>;
  teamStats: Array<{ teamId: string; teamName: string; stats: Record<string, string> }>;
}>(`/matches/${matchId}/espn`);
