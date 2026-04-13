import Dexie, { type Table } from 'dexie';
import type { Match, Ball, Player, Team, Tournament } from './types';

export class CricketDB extends Dexie {
  tournaments!: Table<Tournament>;
  teams!: Table<Team>;
  players!: Table<Player>;
  matches!: Table<Match>;
  balls!: Table<Ball>;

  constructor() {
    super('CricketDB');
    this.version(1).stores({
      tournaments: '++id, name, created_at',
      teams: '++id, tournament_id, name, created_at',
      players: '++id, team_id, name, is_captain, created_at',
      matches: '++id, tournament_id, team_a_id, team_b_id, status, current_striker_id, non_striker_id, current_bowler_id, created_at',
      balls: '++id, match_id, innings_no, over_no, ball_no, batsman_id, bowler_id, timestamp'
    });
  }
}

export const db = new CricketDB();
