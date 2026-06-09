export interface Team {
  id: number;
  name: string;
  code: string;
  group: string;
  flagUrl: string;
  defaultFormation: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  players?: Player[];
}

export interface Player {
  id: number;
  name: string;
  teamId: number;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  shirtNumber: number | null;
  age: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  cleanSheets: number;
  minutesPlayed: number;
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  isCaptain: number;
  isCornerKicker: number;
  isFreekickTaker: number;
  isPenaltyTaker: number;
  team?: Team;
}

export interface Match {
  id: number;
  stage: string;
  groupName: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: 'Scheduled' | 'Live' | 'Finished';
  date: string;
  venue: string;
  motmPlayerId: number | null;
  espnEventId?: string | null;
  homeTeam?: Team;
  awayTeam?: Team;
  motmPlayer?: Player;
  events?: MatchEvent[];
}

export interface MatchEvent {
  id: number;
  matchId: number;
  playerId: number | null;
  teamId: number | null;
  eventType: 'Goal' | 'OwnGoal' | 'Assist' | 'Yellow' | 'Red';
  minute: number | null;
  description: string;
  player?: Player;
  team?: Team;
}

export interface GroupStandings {
  [group: string]: Team[];
}

export interface StatsOverview {
  topScorers: Player[];
  topAssists: Player[];
  cleanSheets: Player[];
}

export interface LineupPlayer {
  id: number;
  matchId: number;
  teamId: number;
  playerId: number;
  posX: number;
  posY: number;
  isStarter: number;
  player?: Player;
}

export interface ScraperLog {
  id: number;
  runAt: string;
  type: string;
  status: string;
  recordsUpdated: number;
  message: string;
  durationMs: number;
}

export interface TeamStat {
  id: number;
  name: string;
  code: string;
  flagUrl: string;
  group?: string;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  played: number;
}

export interface RadarMetric {
  subject: string;
  value: number;
}

export interface TeamRadar {
  teamId: number;
  name: string;
  code: string;
  flagUrl: string;
  metrics: RadarMetric[];
}

export interface EfficiencyTeam {
  id: number;
  name: string;
  code: string;
  flagUrl: string;
  group: string;
  goalsFor: number;
  goalsAgainst: number;
  gamesPlayed: number;
  cleanSheets: number;
  totalShots: number;
  totalShotsOnTarget: number;
  conversion: number;
  totalYellow: number;
  totalRed: number;
  totalFouls: number;
  avgGoalsPerGame: number;
}
