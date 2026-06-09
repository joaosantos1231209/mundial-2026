import { pgTable, text, integer, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  group: text('group').notNull(),
  flagUrl: text('flag_url').notNull().default(''),
  defaultFormation: text('default_formation').notNull().default('4-4-2'),
  espnId: integer('espn_id'),
  wins: integer('wins').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  goalsFor: integer('goals_for').notNull().default(0),
  goalsAgainst: integer('goals_against').notNull().default(0),
  points: integer('points').notNull().default(0),
});

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  position: text('position').notNull().default('MID'),
  shirtNumber: integer('shirt_number'),
  age: integer('age'),
  goals: integer('goals').notNull().default(0),
  assists: integer('assists').notNull().default(0),
  yellowCards: integer('yellow_cards').notNull().default(0),
  redCards: integer('red_cards').notNull().default(0),
  cleanSheets: integer('clean_sheets').notNull().default(0),
  minutesPlayed: integer('minutes_played').notNull().default(0),
  shots: integer('shots').notNull().default(0),
  shotsOnTarget: integer('shots_on_target').notNull().default(0),
  fouls: integer('fouls').notNull().default(0),
  isCaptain: integer('is_captain').notNull().default(0),
  isCornerKicker: integer('is_corner_kicker').notNull().default(0),
  isFreekickTaker: integer('is_freekick_taker').notNull().default(0),
  isPenaltyTaker: integer('is_penalty_taker').notNull().default(0),
});

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  stage: text('stage').notNull().default('Group'),
  groupName: text('group_name'),
  homeTeamId: integer('home_team_id').notNull().references(() => teams.id),
  awayTeamId: integer('away_team_id').notNull().references(() => teams.id),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  status: text('status').notNull().default('Scheduled'),
  date: text('date').notNull(),
  venue: text('venue').notNull().default(''),
  motmPlayerId: integer('motm_player_id').references(() => players.id),
  espnEventId: text('espn_event_id'),
});

export const matchEvents = pgTable('match_events', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull().references(() => matches.id),
  playerId: integer('player_id').references(() => players.id),
  teamId: integer('team_id').references(() => teams.id),
  eventType: text('event_type').notNull(),
  minute: integer('minute'),
  description: text('description').notNull().default(''),
});

export const lineups = pgTable('lineups', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull().references(() => matches.id),
  teamId: integer('team_id').notNull().references(() => teams.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  posX: integer('pos_x').notNull().default(50),
  posY: integer('pos_y').notNull().default(50),
  isStarter: integer('is_starter').notNull().default(1),
});

export const scraperLogs = pgTable('scraper_logs', {
  id: serial('id').primaryKey(),
  runAt: text('run_at').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  recordsUpdated: integer('records_updated').notNull().default(0),
  message: text('message').notNull().default(''),
  durationMs: integer('duration_ms').notNull().default(0),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  players: many(players),
  homeMatches: many(matches, { relationName: 'homeTeam' }),
  awayMatches: many(matches, { relationName: 'awayTeam' }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
  matchEvents: many(matchEvents),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: 'homeTeam' }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: 'awayTeam' }),
  motmPlayer: one(players, { fields: [matches.motmPlayerId], references: [players.id] }),
  events: many(matchEvents),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, { fields: [matchEvents.matchId], references: [matches.id] }),
  player: one(players, { fields: [matchEvents.playerId], references: [players.id] }),
  team: one(teams, { fields: [matchEvents.teamId], references: [teams.id] }),
}));

export const lineupsRelations = relations(lineups, ({ one }) => ({
  match: one(matches, { fields: [lineups.matchId], references: [matches.id] }),
  team: one(teams, { fields: [lineups.teamId], references: [teams.id] }),
  player: one(players, { fields: [lineups.playerId], references: [players.id] }),
}));
