export interface Player {
  id: string;
  team_id: string;
  name: string;
  is_captain: boolean;
  isCaptain?: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  tournament_id: string | null;
  name: string;
  icon?: string;
  created_at: string;
  players?: Player[];
}

export interface Tournament {
  id: string;
  name: string;
  format: 'test' | 'odi' | 't20';
  type: 'round-robin' | 'knockout' | 'groups';
  points_win: number;
  points_draw: number;
  points_loss: number;
  min_players?: number;
  min_wickets?: number;
  min_teams?: number;
  custom_overs?: number;
  created_at: string;
  teams?: Team[];
  matches?: Match[];
  status: 'ongoing' | 'finished';
  winner_id?: string;
  winner_name?: string;
  winning_captain_name?: string;
}

export interface Ball {
  id: string;
  match_id: string;
  innings_no: number;
  over_no: number;
  ball_no: number;
  runs: number;
  extra_runs: number;
  extra_type: 'wide' | 'noball' | 'bye' | 'legbye' | null;
  wicket_type: string | null;
  batsman_id: string;
  bowler_id: string;
  wicket_taker_id: string | null;
  batsman_name?: string;
  bowler_name?: string;
  wicket_taker_name?: string;
  timestamp: string;
}

export interface Match {
  id: string;
  tournament_id: string | null;
  team_a_id: string;
  team_b_id: string;
  team_a_name: string;
  team_b_name: string;
  team_a_icon?: string;
  team_b_icon?: string;
  tournament_name?: string;
  total_overs: number;
  wickets: number;
  current_innings: number;
  match_type: 'test' | 'odi' | 't20';
  day_no: number;
  is_declared: boolean;
  toss_winner_id?: string;
  toss_decision?: 'bat' | 'bowl';
  winner_id?: string;
  result_message?: string;
  status: 'ongoing' | 'finished';
  stage?: string;
  session?: 'morning' | 'afternoon' | 'evening';
  is_follow_on?: boolean;
  created_at: string;
  balls?: Ball[];
  current_striker_id?: string | null;
  non_striker_id?: string | null;
  current_bowler_id?: string | null;
  players?: {
    team_a: Player[];
    team_b: Player[];
  };
}
