import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs,
  where,
  setDoc,
  limit,
  type DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Match, Ball, Player, Team, Tournament } from '../types';

export const api = {
  async getTournaments(): Promise<Tournament[]> {
    const s = await getDocs(query(collection(db, 'tournaments'), orderBy('created_at', 'desc')));
    return s.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
  },

  async createTournament(name: string): Promise<Tournament> {
    const data = {
      name,
      created_at: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'tournaments'), data);
    return { id: docRef.id, ...data } as Tournament;
  },

  async getTeams(tournamentId?: string): Promise<Team[]> {
    let q = query(collection(db, 'teams'));
    if (tournamentId) {
      q = query(q, where('tournament_id', '==', tournamentId));
    }
    const s = await getDocs(q);
    return s.docs.map(d => ({ id: d.id, ...d.data() } as Team));
  },

  async createTeam(tournamentId: string | null, name: string): Promise<Team> {
    const data = {
      tournament_id: tournamentId,
      name,
      created_at: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'teams'), data);
    return { id: docRef.id, ...data } as Team;
  },

  async getPlayers(teamId: string): Promise<Player[]> {
    const q = query(collection(db, 'players'), where('team_id', '==', teamId));
    const s = await getDocs(q);
    return s.docs.map(d => ({ id: d.id, ...d.data() } as Player));
  },

  async createPlayer(teamId: string, name: string, isCaptain: boolean = false): Promise<Player> {
    const data = {
      team_id: teamId,
      name,
      is_captain: isCaptain,
      created_at: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'players'), data);
    return { id: docRef.id, ...data } as Player;
  },

  async getMatches(): Promise<Match[]> {
    const s = await getDocs(query(collection(db, 'matches'), orderBy('created_at', 'desc')));
    const matches = s.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    
    // Resolve team names
    for (const match of matches) {
      const teamA = await getDoc(doc(db, 'teams', match.team_a_id));
      const teamB = await getDoc(doc(db, 'teams', match.team_b_id));
      match.team_a_name = teamA.exists() ? (teamA.data() as any).name : 'Team A';
      match.team_b_name = teamB.exists() ? (teamB.data() as any).name : 'Team B';
    }
    return matches;
  },

  async getMatch(id: string): Promise<Match> {
    const d = await getDoc(doc(db, 'matches', id));
    if (!d.exists()) throw new Error('Match not found');
    const match = { id: d.id, ...d.data() } as Match;

    const teamA = await getDoc(doc(db, 'teams', match.team_a_id));
    const teamB = await getDoc(doc(db, 'teams', match.team_b_id));
    match.team_a_name = teamA.exists() ? (teamA.data() as any).name : 'Team A';
    match.team_b_name = teamB.exists() ? (teamB.data() as any).name : 'Team B';

    const ballsS = await getDocs(query(collection(db, 'balls'), where('match_id', '==', id), orderBy('timestamp', 'asc')));
    match.balls = ballsS.docs.map(bd => ({ id: bd.id, ...bd.data() } as Ball));

    const playersA = await getDocs(query(collection(db, 'players'), where('team_id', '==', match.team_a_id)));
    const playersB = await getDocs(query(collection(db, 'players'), where('team_id', '==', match.team_b_id)));
    
    match.players = {
      team_a: playersA.docs.map(pd => ({ id: pd.id, ...pd.data() } as Player)),
      team_b: playersB.docs.map(pd => ({ id: pd.id, ...pd.data() } as Player))
    };

    return match;
  },

  async createMatch(data: { tournament_id: string | null, team_a_id: string, team_b_id: string, total_overs: number, wickets: number }): Promise<Match> {
    const matchData = {
      ...data,
      current_innings: 1,
      status: 'ongoing',
      created_at: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'matches'), matchData);
    return { id: docRef.id, ...matchData } as Match;
  },

  async updateMatch(id: string, updates: Partial<Match>): Promise<void> {
    await updateDoc(doc(db, 'matches', id), updates);
  },

  async getBalls(matchId: string): Promise<Ball[]> {
    const s = await getDocs(query(collection(db, 'balls'), where('match_id', '==', matchId), orderBy('timestamp', 'asc')));
    return s.docs.map(d => ({ id: d.id, ...d.data() } as Ball));
  },

  async addBall(matchId: string, ball: Partial<Ball>): Promise<Ball> {
    const data = {
      match_id: matchId,
      ...ball,
      timestamp: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'balls'), data);
    return { id: docRef.id, ...data } as Ball;
  },

  async undoLastBall(matchId: string): Promise<void> {
    const q = query(collection(db, 'balls'), where('match_id', '==', matchId), orderBy('timestamp', 'desc'), limit(1));
    const s = await getDocs(q);
    if (!s.empty) {
      await deleteDoc(doc(db, 'balls', s.docs[0].id));
    }
  }
};
