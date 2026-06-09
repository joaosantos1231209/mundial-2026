import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'mundial.db');
const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    "group" TEXT NOT NULL,
    flag_url TEXT NOT NULL DEFAULT '',
    default_formation TEXT NOT NULL DEFAULT '4-4-2',
    espn_id INTEGER,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    position TEXT NOT NULL DEFAULT 'MID',
    shirt_number INTEGER,
    age INTEGER,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    yellow_cards INTEGER NOT NULL DEFAULT 0,
    red_cards INTEGER NOT NULL DEFAULT 0,
    clean_sheets INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage TEXT NOT NULL DEFAULT 'Group',
    group_name TEXT,
    home_team_id INTEGER NOT NULL REFERENCES teams(id),
    away_team_id INTEGER NOT NULL REFERENCES teams(id),
    home_score INTEGER,
    away_score INTEGER,
    status TEXT NOT NULL DEFAULT 'Scheduled',
    date TEXT NOT NULL,
    venue TEXT NOT NULL DEFAULT '',
    motm_player_id INTEGER REFERENCES players(id),
    espn_event_id TEXT
  );

  CREATE TABLE IF NOT EXISTS match_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id),
    player_id INTEGER REFERENCES players(id),
    team_id INTEGER REFERENCES teams(id),
    event_type TEXT NOT NULL,
    minute INTEGER,
    description TEXT NOT NULL DEFAULT ''
  );
`);

console.log('✅ Tabelas criadas em', dbPath);
sqlite.close();
