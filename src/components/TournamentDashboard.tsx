import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Trophy, Plus, Users, Calendar, BarChart2, ChevronRight, Share2, Trash2, ChevronDown, ChevronUp, Smile } from 'lucide-react';
import { db } from '../db';
import type { Tournament, Team, Match, Ball, Player } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence } from 'motion/react';

// ... (rest of the imports)

// I'll also need to add the ShareModal component or similar.
// I'll define a local ShareModal if needed, or import it from App.tsx if possible.
// Since I can't easily import internal functions from App.tsx, I'll define a simple one here.

function TournamentShareModal({ tournamentId, onClose }: { tournamentId: string, onClose: () => void }) {
  const url = `${window.location.origin}/tournament/${tournamentId}`;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-brutal-black border border-neon-cyan p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,255,255,0.2)]"
      >
        <h2 className="font-serif text-3xl mb-4 italic text-neon-cyan">Share Tournament</h2>
        <p className="text-white/60 text-sm mb-6">Share this URL to show live tournament standings and matches.</p>
        
        <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-3 mb-6">
          <input 
            readOnly 
            value={url} 
            className="bg-transparent flex-1 text-xs font-mono text-neon-cyan outline-none"
          />
          <button 
            onClick={copyToClipboard}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-neon-cyan"
          >
            {copied ? <div className="text-green-500 text-[10px] font-bold">COPIED</div> : <Share2 size={16} />}
          </button>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-4 bg-neon-cyan text-brutal-black font-black rounded-xl"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}

function TrophyCelebration({ winnerName, captainName, onClose }: { winnerName: string, captainName: string, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-brutal-black/95 z-[100] flex flex-col items-center justify-center p-6 text-center overflow-hidden"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 12, stiffness: 100 }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 bg-neon-cyan blur-[100px] opacity-30 animate-pulse" />
        <Trophy size={160} className="text-neon-cyan drop-shadow-[0_0_30px_rgba(0,255,255,0.8)] relative z-10" />
      </motion.div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <h2 className="text-2xl font-mono uppercase tracking-[0.3em] text-white/60">Tournament Champions</h2>
        <h1 className="text-7xl font-black text-neon-cyan uppercase tracking-tighter leading-none italic">
          {winnerName}
        </h1>
        <p className="text-xl text-white/40 italic">under the captainship of {captainName}</p>
      </motion.div>

      <motion.button
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onClose}
        className="mt-12 px-12 py-4 bg-neon-cyan text-brutal-black font-black uppercase tracking-widest rounded-full hover:scale-110 transition-transform"
      >
        Close
      </motion.button>

      {/* Confetti-like particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * window.innerWidth - window.innerWidth/2, 
            y: window.innerHeight + 100,
            rotate: 0 
          }}
          animate={{ 
            y: -100,
            rotate: 360,
            x: (Math.random() - 0.5) * 500
          }}
          transition={{ 
            duration: 2 + Math.random() * 3, 
            repeat: Infinity,
            delay: Math.random() * 2
          }}
          className="absolute w-2 h-2 bg-neon-cyan/40 rounded-full"
        />
      ))}
    </motion.div>
  );
}

export default function TournamentDashboard({ onPlayMatch, playingMatchId, renderMatchDashboard, initialTournamentId }: { onPlayMatch: (matchId: string) => void, playingMatchId?: string | null, renderMatchDashboard?: (matchId: string) => React.ReactNode, initialTournamentId?: string | null }) {
  const [showSetup, setShowSetup] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const tournaments = useLiveQuery(() => db.tournaments.orderBy('created_at').reverse().toArray());

  useEffect(() => {
    if (initialTournamentId && tournaments && tournaments.length > 0) {
      const t = tournaments.find(t => t.id === initialTournamentId);
      if (t) setSelectedTournament(t);
    }
  }, [initialTournamentId, tournaments]);

  return (
    <div className="p-6">
      {selectedTournament ? (
        <TournamentDetail 
          tournament={selectedTournament} 
          onBack={() => setSelectedTournament(null)} 
          onPlayMatch={onPlayMatch}
          playingMatchId={playingMatchId}
          renderMatchDashboard={renderMatchDashboard}
        />
      ) : (
        <>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-serif italic text-neon-cyan">Tournaments</h2>
            <button 
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-2 bg-neon-cyan text-brutal-black px-4 py-2 rounded-full font-bold text-sm hover:brightness-110 transition-all"
            >
              <Plus size={16} /> New Tournament
            </button>
          </div>
          
          {showSetup && <TournamentSetup onClose={() => setShowSetup(false)} />}
          
          {tournaments && tournaments.length > 0 ? (
            <div className="grid gap-4">
              {tournaments.map(t => (
                <div key={t.id} className="relative group">
                  <button 
                    onClick={() => setSelectedTournament(t)}
                    className="w-full flex items-center justify-between bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${t.status === 'finished' ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/5 text-white/30'}`}>
                        <Trophy size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{t.name}</h3>
                        <p className="text-xs text-white/50 uppercase tracking-widest">
                          {t.format} • {t.custom_overs ? `${t.custom_overs} Overs` : (t.format === 't20' ? '20 Overs' : t.format === 'odi' ? '50 Overs' : '5-Day Test')} • {t.type} • {t.status === 'finished' ? 'Completed' : 'Ongoing'}
                        </p>
                        {t.status === 'finished' && t.winner_name && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] bg-neon-cyan text-brutal-black px-2 py-0.5 rounded font-bold uppercase">Winner</span>
                            <span className="text-sm font-bold text-neon-cyan">{t.winner_name}</span>
                            {t.winning_captain_name && (
                              <span className="text-[10px] text-white/40 italic">under {t.winning_captain_name}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="text-white/30" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTournamentToDelete(t);
                    }}
                    className="absolute top-4 right-4 p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete Tournament"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-white/20 rounded-2xl">
              <Trophy className="mx-auto w-16 h-16 text-neon-cyan/50 mb-4" />
              <p className="text-white/60">No tournaments yet. Create your first championship!</p>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {tournamentToDelete && (
          <DeleteConfirmationModal 
            tournamentName={tournamentToDelete.name}
            onConfirm={async () => {
              await db.tournaments.delete(tournamentToDelete.id);
              await db.teams.where('tournament_id').equals(tournamentToDelete.id).delete();
              await db.matches.where('tournament_id').equals(tournamentToDelete.id).delete();
              setTournamentToDelete(null);
              if (selectedTournament?.id === tournamentToDelete.id) {
                setSelectedTournament(null);
              }
            }}
            onCancel={() => setTournamentToDelete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TeamItem({ team }: { team: Team }) {
  const players = useLiveQuery(() => db.players.where('team_id').equals(team.id).toArray());
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const icons = ['🏏', '🏆', '🔥', '⚡', '🦁', '🐅', '🦅', '⚔️', '🛡️', '🌟', '💎', '🎯'];

  const addPlayer = async () => {
    if (!newPlayerName) return;
    await db.players.add({
      team_id: team.id,
      name: newPlayerName,
      is_captain: false,
      created_at: new Date().toISOString()
    } as any);
    setNewPlayerName('');
  };

  const updateIcon = async (icon: string) => {
    await db.teams.update(team.id, { icon });
    setShowIconPicker(false);
  };

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-neon-cyan/30 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-xl hover:bg-white/10 transition-colors border border-white/5"
          >
            {team.icon || <Smile size={20} className="text-white/30" />}
          </button>
          <div>
            <div className="font-bold text-neon-cyan text-lg leading-tight">{team.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-mono">{players?.length || 0} Players</div>
          </div>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-white/10 rounded transition-colors text-white/40"
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {showIconPicker && (
        <div className="grid grid-cols-6 gap-2 mb-4 p-2 bg-black/40 rounded-lg border border-white/5">
          {icons.map(icon => (
            <button 
              key={icon} 
              onClick={() => updateIcon(icon)}
              className="text-xl hover:scale-125 transition-transform p-1"
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {players?.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm text-white/80 bg-white/5 p-2 rounded border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-neon-cyan/40">•</span>
                    {p.name}
                    {p.is_captain && <span className="text-[10px] bg-neon-cyan text-brutal-black px-1 rounded font-bold uppercase tracking-tighter">C</span>}
                  </div>
                  <button 
                    onClick={async () => await db.players.delete(p.id)}
                    className="text-red-500/40 hover:text-red-500 transition-colors"
                  >
                    <Plus className="rotate-45" size={14} />
                  </button>
                </div>
              ))}
              {(!players || players.length === 0) && (
                <div className="text-xs text-white/30 italic text-center py-2">No players added yet</div>
              )}
            </div>
            
            <div className="flex gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
              <input 
                value={newPlayerName} 
                onChange={(e) => setNewPlayerName(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                placeholder="Add Player..." 
                className="flex-1 bg-transparent p-1 rounded text-sm text-white outline-none placeholder:text-white/20" 
              />
              <button 
                onClick={addPlayer} 
                className="bg-neon-cyan text-brutal-black w-8 h-8 rounded flex items-center justify-center font-bold hover:brightness-110 transition-all"
              >
                <Plus size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TournamentDetail({ tournament, onBack, onPlayMatch, playingMatchId, renderMatchDashboard }: { tournament: Tournament, onBack: () => void, onPlayMatch: (matchId: string) => void, playingMatchId?: string | null, renderMatchDashboard?: (matchId: string) => React.ReactNode }) {
  const teams = useLiveQuery(() => db.teams.where('tournament_id').equals(tournament.id).toArray(), [tournament.id]);
  const matches = useLiveQuery(() => db.matches.where('tournament_id').equals(tournament.id).toArray(), [tournament.id]);
  const matchIds = matches?.map(m => m.id) || [];
  const balls = useLiveQuery(async () => {
    if (matchIds.length === 0) return [];
    return await db.balls.where('match_id').anyOf(matchIds).toArray();
  }, [matchIds.join(',')]);
  
  const teamIds = teams?.map(t => t.id) || [];
  const players = useLiveQuery(async () => {
    if (teamIds.length === 0) return [];
    return await db.players.where('team_id').anyOf(teamIds).toArray();
  }, [teamIds.join(',')]);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [activeTab, setActiveTab] = useState<'matches' | 'standings' | 'stats'>('matches');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTrophyCelebration, setShowTrophyCelebration] = useState(false);

  const addTeam = async () => {
    if (!newTeamName) return;
    await db.teams.add({
      tournament_id: tournament.id,
      name: newTeamName,
      created_at: new Date().toISOString()
    } as any);
    setNewTeamName('');
    setShowAddTeam(false);
  };

  const handleFinishTournament = async (winnerId: string) => {
    const winner = teams?.find(t => t.id === winnerId);
    if (!winner) return;
    
    const winnerPlayers = await db.players.where('team_id').equals(winner.id).toArray();
    const captain = winnerPlayers.find(p => p.is_captain) || winnerPlayers[0];

    await db.tournaments.update(tournament.id, {
      status: 'finished',
      winner_id: winnerId,
      winner_name: winner.name,
      winning_captain_name: captain?.name || 'Unknown'
    });
    setShowTrophyCelebration(true);
  };

  const generateMatches = async () => {
    if (!teams || teams.length < 2) return;

    for (const team of teams) {
      const players = await db.players.where('team_id').equals(team.id).toArray();
      if (players.length < (tournament.min_players || 1)) {
        alert(`Team ${team.name} needs at least ${tournament.min_players || 1} players.`);
        return;
      }
    }

    const baseMatch = {
      tournament_id: tournament.id,
      status: 'ongoing',
      created_at: new Date().toISOString(),
      total_overs: tournament.custom_overs || (tournament.format === 't20' ? 20 : tournament.format === 'odi' ? 50 : 450),
      wickets: tournament.min_wickets || 10,
      current_innings: 1,
      match_type: tournament.format,
      day_no: 1,
      is_declared: false
    };

    if (tournament.type !== 'knockout') {
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          await db.matches.add({
            ...baseMatch,
            team_a_id: teams[i].id,
            team_b_id: teams[j].id,
            team_a_name: teams[i].name,
            team_b_name: teams[j].name,
            stage: 'Group Stage'
          } as any);
        }
      }
    }

    if (teams.length >= 8) {
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Rank 1', team_b_name: 'Rank 8', stage: 'Quarter-Final 1' } as any);
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Rank 2', team_b_name: 'Rank 7', stage: 'Quarter-Final 2' } as any);
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Rank 3', team_b_name: 'Rank 6', stage: 'Quarter-Final 3' } as any);
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Rank 4', team_b_name: 'Rank 5', stage: 'Quarter-Final 4' } as any);
      
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Winner QF1', team_b_name: 'Winner QF4', stage: 'Semi-Final 1' } as any);
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Winner QF2', team_b_name: 'Winner QF3', stage: 'Semi-Final 2' } as any);
      
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Winner SF1', team_b_name: 'Winner SF2', stage: 'Final' } as any);
    } else if (teams.length >= 4) {
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Rank 1', team_b_name: 'Rank 4', stage: 'Semi-Final 1' } as any);
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Rank 2', team_b_name: 'Rank 3', stage: 'Semi-Final 2' } as any);
      
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Winner SF1', team_b_name: 'Winner SF2', stage: 'Final' } as any);
    } else if (teams.length >= 2) {
      await db.matches.add({ ...baseMatch, team_a_id: 'tbd', team_b_id: 'tbd', team_a_name: 'Rank 1', team_b_name: 'Rank 2', stage: 'Final' } as any);
    }
  };

  const standings = useMemo(() => {
    if (!teams || !matches || !balls) return [];
    
    return teams.map(team => {
      const teamMatches = matches.filter(m => String(m.team_a_id) === String(team.id) || String(m.team_b_id) === String(team.id));
      const finishedMatches = teamMatches.filter(m => m.status === 'finished');
      const wins = finishedMatches.filter(m => String(m.winner_id) === String(team.id)).length;
      const draws = finishedMatches.filter(m => !m.winner_id && m.result_message?.includes('Drawn')).length;
      const ties = finishedMatches.filter(m => !m.winner_id && m.result_message?.includes('Tied')).length;
      const losses = finishedMatches.length - wins - draws - ties;
      
      let runsScored = 0;
      let ballsFaced = 0;
      let runsConceded = 0;
      let ballsBowled = 0;

      finishedMatches.forEach(m => {
        const isTeamABattingFirst = String(m.toss_winner_id) === String(m.team_a_id) ? m.toss_decision === 'bat' : m.toss_decision === 'bowl';
        const isTeamA = String(m.team_a_id) === String(team.id);
        
        let teamBattingInnings: number[] = [];
        let teamBowlingInnings: number[] = [];

        if (m.is_follow_on) {
          if (isTeamABattingFirst) {
            // Team A: 1, 4. Team B: 2, 3.
            teamBattingInnings = isTeamA ? [1, 4] : [2, 3];
            teamBowlingInnings = isTeamA ? [2, 3] : [1, 4];
          } else {
            // Team B: 1, 4. Team A: 2, 3.
            teamBattingInnings = isTeamA ? [2, 3] : [1, 4];
            teamBowlingInnings = isTeamA ? [1, 4] : [2, 3];
          }
        } else {
          if (isTeamABattingFirst) {
            // Team A: 1, 3. Team B: 2, 4.
            teamBattingInnings = isTeamA ? [1, 3] : [2, 4];
            teamBowlingInnings = isTeamA ? [2, 4] : [1, 3];
          } else {
            // Team B: 1, 3. Team A: 2, 4.
            teamBattingInnings = isTeamA ? [2, 4] : [1, 3];
            teamBowlingInnings = isTeamA ? [1, 3] : [2, 4];
          }
        }

        const matchBalls = balls.filter(b => b.match_id === m.id);
        
        const battingBalls = matchBalls.filter(b => teamBattingInnings.includes(b.innings_no));
        const bowlingBalls = matchBalls.filter(b => teamBowlingInnings.includes(b.innings_no));

        runsScored += battingBalls.reduce((sum, b) => sum + b.runs + b.extra_runs, 0);
        runsConceded += bowlingBalls.reduce((sum, b) => sum + b.runs + b.extra_runs, 0);

        const legalBattingBalls = battingBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'noball').length;
        const legalBowlingBalls = bowlingBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'noball').length;

        // For NRR, if all out, use full quota of overs
        // In Test matches, this is tricky, but we'll use the balls actually bowled
        const wicketsLost = battingBalls.filter(b => b.wicket_type).length;
        if (m.match_type !== 'test' && wicketsLost >= m.wickets) {
           ballsFaced += m.total_overs * 6;
        } else {
           ballsFaced += legalBattingBalls;
        }

        const wicketsTaken = bowlingBalls.filter(b => b.wicket_type).length;
        if (m.match_type !== 'test' && wicketsTaken >= m.wickets) {
           ballsBowled += m.total_overs * 6;
        } else {
           ballsBowled += legalBowlingBalls;
        }
      });

      const oversFaced = ballsFaced / 6;
      const oversBowled = ballsBowled / 6;
      
      const nrr = oversFaced > 0 && oversBowled > 0 
        ? (runsScored / oversFaced) - (runsConceded / oversBowled) 
        : 0;

      return {
        id: team.id,
        name: team.name,
        played: finishedMatches.length,
        wins,
        losses,
        draws,
        points: (wins * 2) + draws + ties,
        nrr: nrr.toFixed(3)
      };
    }).sort((a, b) => b.points - a.points || parseFloat(b.nrr) - parseFloat(a.nrr));
  }, [teams, matches, balls]);

  const playerStats = useMemo(() => {
    if (!players || !balls) return [];
    
    const stats: Record<string, any> = {};
    players.forEach(p => {
      stats[String(p.id)] = { id: p.id, name: p.name, team_id: p.team_id, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
    });

    balls.forEach(b => {
      const bId = b.batsman_id ? String(b.batsman_id) : null;
      const bowId = b.bowler_id ? String(b.bowler_id) : null;
      if (bId && stats[bId]) {
        stats[bId].runs += Number(b.runs || 0);
        if (b.extra_type !== 'wide') stats[bId].balls += 1;
        if (Number(b.runs) === 4) stats[bId].fours += 1;
        if (Number(b.runs) === 6) stats[bId].sixes += 1;
      }
      if (bowId && stats[bowId]) {
        stats[bowId].runsConceded += (Number(b.runs || 0) + Number(b.extra_runs || 0));
        if (b.extra_type !== 'wide' && b.extra_type !== 'noball') stats[bowId].ballsBowled += 1;
        if (b.wicket_type && b.wicket_type !== 'Run Out') stats[bowId].wickets += 1;
      }
    });

    return Object.values(stats).map(s => {
      s.strikeRate = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0';
      s.economy = s.ballsBowled > 0 ? (s.runsConceded / (s.ballsBowled / 6)).toFixed(2) : '0.00';
      return s;
    });
  }, [players, balls]);

  const topBatsmen = [...playerStats].sort((a, b) => b.runs - a.runs).slice(0, 10);
  const topBowlers = [...playerStats].sort((a, b) => b.wickets - a.wickets || parseFloat(a.economy) - parseFloat(b.economy)).slice(0, 10);

  const canGenerateMatches = teams && teams.length >= 2;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-neon-cyan text-sm mb-4">← Back to Tournaments</button>
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-serif italic text-neon-cyan">{tournament.name}</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowShareModal(true)}
            className="p-2 border border-white/10 rounded-full text-white/50 hover:text-neon-cyan hover:border-neon-cyan transition-all"
            title="Share Tournament"
          >
            <Share2 size={20} />
          </button>
          {canGenerateMatches && matches?.length === 0 && (
            <button onClick={generateMatches} className="bg-neon-cyan text-brutal-black px-4 py-2 rounded-full font-bold text-sm">Generate Matches</button>
          )}
        </div>
      </div>

      {playingMatchId && renderMatchDashboard ? (
        <div className="mt-6">
          {renderMatchDashboard(playingMatchId)}
        </div>
      ) : (
        <>
          <div className="flex gap-4 border-b border-white/10 pb-2">
            <button onClick={() => setActiveTab('matches')} className={`pb-2 px-2 font-bold ${activeTab === 'matches' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-white/50'}`}>Matches & Teams</button>
            <button onClick={() => setActiveTab('standings')} className={`pb-2 px-2 font-bold ${activeTab === 'standings' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-white/50'}`}>Standings</button>
            <button onClick={() => setActiveTab('stats')} className={`pb-2 px-2 font-bold ${activeTab === 'stats' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-white/50'}`}>Player Stats</button>
          </div>
          
          {activeTab === 'matches' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">Teams</h3>
                  {tournament.status !== 'finished' && (
                    <button onClick={() => setShowAddTeam(!showAddTeam)} className="text-neon-cyan text-sm">+ Add Team</button>
                  )}
                </div>
                {showAddTeam && (
                  <div className="flex gap-2 mb-4">
                    <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team Name" className="flex-1 bg-white/5 p-2 rounded text-white" />
                    <button onClick={addTeam} className="bg-neon-cyan text-brutal-black px-4 py-2 rounded font-bold">Add</button>
                  </div>
                )}
                <div className="space-y-2">
                  {teams?.map(t => <TeamItem key={t.id} team={t} />)}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">Matches</h3>
                </div>
                <div className="space-y-2">
                  {matches?.map(m => (
                    <div key={m.id} className="p-3 bg-white/5 rounded-lg flex justify-between items-center">
                      <div>
                        {m.stage && <div className="text-[10px] uppercase font-mono text-neon-cyan/70 mb-1">{m.stage}</div>}
                        <div className="flex items-center gap-2">
                          {teams?.find(t => t.id === m.team_a_id)?.icon && <span>{teams?.find(t => t.id === m.team_a_id)?.icon}</span>}
                          <span>{m.team_a_name} vs {m.team_b_name}</span>
                          {teams?.find(t => t.id === m.team_b_id)?.icon && <span>{teams?.find(t => t.id === m.team_b_id)?.icon}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs uppercase ${m.status === 'finished' ? 'text-green-500' : 'text-yellow-500'}`}>{m.status}</span>
                        {m.status === 'finished' ? (
                          <span className="text-xs font-bold text-neon-cyan">
                            {m.winner_id === m.team_a_id ? `${m.team_a_name} Won` : m.winner_id === m.team_b_id ? `${m.team_b_name} Won` : 'Tied'}
                          </span>
                        ) : (
                          <button 
                            onClick={() => onPlayMatch(m.id)} 
                            disabled={m.team_a_id === 'tbd' || m.team_b_id === 'tbd' || tournament.status === 'finished'}
                            className="bg-neon-cyan text-brutal-black px-2 py-1 rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {balls?.some(b => b.match_id === m.id) ? 'Resume' : 'Play'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'standings' && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="p-3">Team</th>
                      <th className="p-3">P</th>
                      <th className="p-3">W</th>
                      <th className="p-3">L</th>
                      <th className="p-3">Pts</th>
                      <th className="p-3">NRR</th>
                      {tournament.status !== 'finished' && <th className="p-3 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map(s => (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-3 font-bold flex items-center gap-2">
                          {teams?.find(t => t.id === s.id)?.icon && <span className="text-xl">{teams?.find(t => t.id === s.id)?.icon}</span>}
                          {s.name}
                        </td>
                        <td className="p-3">{s.played}</td>
                        <td className="p-3">{s.wins}</td>
                        <td className="p-3">{s.losses}</td>
                        <td className="p-3 font-bold text-neon-cyan">{s.points}</td>
                        <td className="p-3">{s.nrr}</td>
                        {tournament.status !== 'finished' && (
                          <td className="p-3 text-right">
                            <button 
                              onClick={() => handleFinishTournament(s.id)}
                              className="text-[10px] bg-neon-cyan/20 text-neon-cyan px-2 py-1 rounded font-bold uppercase hover:bg-neon-cyan hover:text-brutal-black transition-all"
                            >
                              Declare Winner
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tournament.status === 'finished' && (
                <div className="bg-neon-cyan/10 border border-neon-cyan/30 p-8 rounded-3xl text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-neon-cyan blur-[100px] opacity-10 animate-pulse" />
                  <Trophy size={80} className="mx-auto text-neon-cyan mb-4 drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]" />
                  <h3 className="text-3xl font-serif italic text-white mb-2">Tournament Champions</h3>
                  <p className="text-5xl font-black text-neon-cyan uppercase tracking-tighter mb-4">{tournament.winner_name}</p>
                  <p className="text-white/40 text-sm uppercase tracking-widest">Captain: {tournament.winning_captain_name}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl overflow-x-auto">
                <h3 className="font-bold text-lg mb-4 text-neon-cyan">Top Batsmen</h3>
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="p-2">Player</th>
                      <th className="p-2">Runs</th>
                      <th className="p-2">SR</th>
                      <th className="p-2">4s</th>
                      <th className="p-2">6s</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBatsmen.filter(p => p.runs > 0).map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-2 font-bold font-sans">{p.name}</td>
                        <td className="p-2 text-neon-cyan font-bold">{p.runs}</td>
                        <td className="p-2">{p.strikeRate}</td>
                        <td className="p-2">{p.fours}</td>
                        <td className="p-2">{p.sixes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl overflow-x-auto">
                <h3 className="font-bold text-lg mb-4 text-neon-cyan">Top Bowlers</h3>
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="p-2">Player</th>
                      <th className="p-2">Wickets</th>
                      <th className="p-2">Econ</th>
                      <th className="p-2">Overs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBowlers.filter(p => p.wickets > 0 || p.ballsBowled > 0).map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-2 font-bold font-sans">{p.name}</td>
                        <td className="p-2 text-neon-cyan font-bold">{p.wickets}</td>
                        <td className="p-2">{p.economy}</td>
                        <td className="p-2">{Math.floor(p.ballsBowled / 6)}.{p.ballsBowled % 6}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showShareModal && (
          <TournamentShareModal 
            tournamentId={tournament.id.toString()} 
            onClose={() => setShowShareModal(false)} 
          />
        )}
        {showTrophyCelebration && (
          <TrophyCelebration 
            winnerName={tournament.winner_name || ''} 
            captainName={tournament.winning_captain_name || ''} 
            onClose={() => setShowTrophyCelebration(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function DeleteConfirmationModal({ tournamentName, onConfirm, onCancel }: { tournamentName: string, onConfirm: () => void, onCancel: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-brutal-black border border-red-500/50 p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(220,38,38,0.2)]"
      >
        <h2 className="font-serif text-3xl mb-4 italic text-red-500">Delete Tournament?</h2>
        <p className="text-white/60 text-sm mb-8">Are you sure you want to delete <span className="text-white font-bold">{tournamentName}</span>? This action cannot be undone and all match data will be lost.</p>
        
        <div className="flex gap-4">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 border border-white/10 rounded-xl font-bold hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-all"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TournamentSetup({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'test' | 'odi' | 't20'>('t20');

  const [minPlayers, setMinPlayers] = useState(11);
  const [minWickets, setMinWickets] = useState(10);
  const [minTeams, setMinTeams] = useState(2);
  const [customOvers, setCustomOvers] = useState<number | ''>('');

  const handleSubmit = async () => {
    await db.tournaments.add({
      name,
      format,
      type: 'round-robin',
      points_win: 2,
      points_draw: 1,
      points_loss: 0,
      min_players: minPlayers,
      min_wickets: minWickets,
      min_teams: minTeams,
      custom_overs: customOvers === '' ? undefined : customOvers,
      created_at: new Date().toISOString()
    } as any);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
    >
      <div className="bg-brutal-black border border-neon-cyan p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,255,255,0.2)]">
        <h2 className="font-serif text-3xl mb-6 italic text-neon-cyan">Setup Tournament</h2>
        <input 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tournament Name"
          className="w-full bg-white/5 border border-white/10 p-3 rounded-lg mb-4 text-white"
        />
        <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="w-full bg-white/5 border border-white/10 p-3 rounded-lg mb-4 text-white">
          <option value="t20">T20</option>
          <option value="odi">ODI</option>
          <option value="test">Test</option>
        </select>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Min Players</label>
            <input type="number" value={minPlayers} onChange={(e) => setMinPlayers(e.target.value === '' ? 0 : parseInt(e.target.value))} placeholder="Min Players" className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Min Wickets</label>
            <input type="number" value={minWickets} onChange={(e) => setMinWickets(e.target.value === '' ? 0 : parseInt(e.target.value))} placeholder="Min Wickets" className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Min Teams</label>
            <input type="number" value={minTeams} onChange={(e) => setMinTeams(e.target.value === '' ? 0 : parseInt(e.target.value))} placeholder="Min Teams" className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Custom Overs (Optional)</label>
            <input type="number" value={customOvers} onChange={(e) => setCustomOvers(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="Default" className="w-full bg-white/5 border border-white/10 p-3 rounded-lg text-white" />
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 p-3 border border-white/20 rounded-xl">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 p-3 bg-neon-cyan text-brutal-black rounded-xl font-bold">Create</button>
        </div>
      </div>
    </motion.div>
  );
}
