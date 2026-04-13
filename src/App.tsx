/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { addBall, undoLast, declareResult, transitionInnings } from './services/scoringService';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { 
  Trophy,
  Users, 
  History as HistoryIcon, 
  Plus, 
  ChevronRight, 
  Undo2, 
  Circle, 
  AlertCircle,
  TrendingUp,
  User,
  Settings2,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import type { Match, Ball, Player, Team, Tournament } from './types';
import History from './components/History';
import LiveScoreboard from './components/LiveScoreboard';
import TournamentDashboard from './components/TournamentDashboard';
import SplashScreen from './components/SplashScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showTournament, setShowTournament] = useState(false);
  const matches = useLiveQuery(async () => {
    const allMatches = await db.matches.toArray();
    const matchesWithIcons = await Promise.all(allMatches.map(async m => {
      const teamA = await db.teams.get(m.team_a_id);
      const teamB = await db.teams.get(m.team_b_id);
      return {
        ...m,
        team_a_icon: teamA?.icon,
        team_b_icon: teamB?.icon
      };
    }));
    return matchesWithIcons;
  });
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isLiveView, setIsLiveView] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showWicketSelect, setShowWicketSelect] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [isTournamentLive, setIsTournamentLive] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showGlassBreak, setShowGlassBreak] = useState(false);

  const selectedMatch = useLiveQuery(async () => {
    if (!selectedMatchId) return null;
    const match = await db.matches.get(selectedMatchId);
    if (!match) return null;

    // Fetch related data
    const balls = await db.balls.where('match_id').equals(selectedMatchId).toArray();
    const teamA = await db.teams.get(match.team_a_id);
    const teamB = await db.teams.get(match.team_b_id);
    
    if (teamA) {
      teamA.players = await db.players.where('team_id').equals(teamA.id).toArray();
    }
    if (teamB) {
      teamB.players = await db.players.where('team_id').equals(teamB.id).toArray();
    }

    return {
      ...match,
      balls,
      team_a_name: teamA?.name || 'Team A',
      team_b_name: teamB?.name || 'Team B',
      team_a_icon: teamA?.icon,
      team_b_icon: teamB?.icon,
      players: {
        team_a: teamA?.players || [],
        team_b: teamB?.players || []
      }
    };
  }, [selectedMatchId]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/live/')) {
      const matchId = parseInt(path.split('/')[2]);
      if (!isNaN(matchId)) {
        setSelectedMatchId(matchId.toString());
        setIsLiveView(true);
      }
    } else if (path.startsWith('/tournament/')) {
      const tId = path.split('/')[2];
      if (tId) {
        setSelectedTournamentId(tId);
        setIsTournamentLive(true);
        setShowTournament(true);
      }
    }
  }, []);

  if (showTournament) {
    return (
      <div className="min-h-screen bg-brutal-black text-white">
        <AnimatePresence>
          {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
        </AnimatePresence>
        {!isTournamentLive && (
          <button onClick={() => setShowTournament(false)} className="p-6 text-neon-cyan">Back</button>
        )}
        <TournamentDashboard 
          playingMatchId={selectedMatchId}
          onPlayMatch={(matchId) => {
            setSelectedMatchId(matchId);
            setIsLiveView(false);
          }} 
          renderMatchDashboard={(matchId) => {
            const match = matches.find(m => m.id === matchId);
            if (!match) return null;
            return (
              <MatchDashboard 
                match={match} 
                onBack={() => setSelectedMatchId(null)} 
                onUpdate={(updatedMatch) => {}}
                onAddBall={addBall}
                onUndoLast={undoLast}
                onDeclare={async () => {
                  if (match.match_type === 'test' && match.current_innings < 4) {
                    await transitionInnings(match, true);
                  } else {
                    await declareResult(match);
                  }
                }}
                isLiveView={isLiveView}
                showVictory={showVictory}
                setShowVictory={setShowVictory}
                setShowGlassBreak={setShowGlassBreak}
              />
            );
          }}
          initialTournamentId={selectedTournamentId}
        />
      </div>
  );
}

  const createMatch = async (teamAId: number, teamBId: number, overs: number, wickets: number, matchType: 'test' | 'odi' | 't20', teamAIcon?: string, teamBIcon?: string) => {
    try {
      const teamA = await db.teams.get(teamAId);
      const teamB = await db.teams.get(teamBId);
      
      const id = await db.matches.add({
        tournament_id: null,
        team_a_id: teamAId,
        team_b_id: teamBId,
        team_a_name: teamA?.name || '',
        team_b_name: teamB?.name || '',
        team_a_icon: teamAIcon || teamA?.icon,
        team_b_icon: teamBIcon || teamB?.icon,
        total_overs: overs,
        wickets: wickets,
        current_innings: 1,
        match_type: matchType,
        day_no: 1,
        is_declared: false,
        status: 'ongoing',
        created_at: new Date().toISOString()
      } as any);
      setSelectedMatchId(id as string);
      setShowSetup(false);
    } catch (err) {
      console.error('Failed to create match:', err);
    }
  };

  const createTournament = async (tournament: any) => {
    try {
      const tournamentId = await db.tournaments.add({
        name: tournament.name,
        created_at: new Date().toISOString()
      } as any);

      if (tournament.teams) {
        for (const team of tournament.teams) {
          const teamId = await db.teams.add({
            tournament_id: tournamentId as number,
            name: team.name,
            created_at: new Date().toISOString()
          } as any);

          for (const playerName of team.players) {
            await db.players.add({
              team_id: teamId as number,
              name: playerName,
              is_captain: false,
              created_at: new Date().toISOString()
            } as any);
          }
        }
      }

      alert('Tournament created successfully!');
    } catch (err) {
      console.error('Failed to create tournament:', err);
    }
  };

  if (!matches || loading) {
    return (
      <>
        <AnimatePresence>
          {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
        </AnimatePresence>
        <div className="min-h-screen flex items-center justify-center bg-brutal-black">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Circle className="w-8 h-8 text-neon-cyan" />
          </motion.div>
        </div>
      </>
    );
  }

  return (
      <motion.div 
        animate={showGlassBreak ? {
          x: [0, -10, 10, -10, 10, 0],
          y: [0, 5, -5, 5, -5, 0],
        } : {}}
        transition={{ duration: 0.4, repeat: showGlassBreak ? 2 : 0 }}
        className="min-h-screen max-w-4xl mx-auto p-4 md:p-8"
      >
      {!isLiveView && !selectedMatchId && (
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-neon-cyan/30 pb-4 gap-4">
          <div>
            <h1 className="font-serif text-6xl font-bold tracking-tighter text-neon-cyan">MY CRICKET</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Powered by ATHER-X PRO • v4.2</p>
          </div>
          <div className="flex gap-3 items-center">
            <button 
              onClick={() => setShowTournament(true)}
              className="flex items-center gap-2 border border-neon-cyan/50 text-neon-cyan px-4 py-2 rounded-full hover:bg-neon-cyan hover:text-brutal-black transition-all text-xs font-bold uppercase tracking-wider"
            >
              <Trophy size={14} />
              Tournament
            </button>
            <button 
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-2 bg-neon-cyan text-brutal-black px-5 py-2 rounded-full hover:brightness-110 transition-all text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,255,0.3)]"
            >
              <Plus size={16} />
              New Match
            </button>
          </div>
        </header>
      )}

      <main>
        {isLiveView ? (
          selectedMatch ? (
            showVictory ? (
              <VictoryCelebration 
                winnerName={selectedMatch.winner_id ? (selectedMatch.winner_id === selectedMatch.team_a_id ? selectedMatch.team_a_name : selectedMatch.team_b_name) : (selectedMatch.result_message?.includes('Drawn') ? 'Draw' : 'Tie')} 
                resultMessage={selectedMatch.result_message} 
                onBack={() => {
                  setSelectedMatchId(null);
                  setIsLiveView(false);
                  setShowVictory(false);
                }} 
                onViewScorecard={() => setShowVictory(false)} 
              />
            ) : (
              <LiveScoreboard 
                match={selectedMatch} 
                addBall={addBall}
                undoLast={undoLast}
                onWicket={() => setShowWicketSelect(true)} 
                onDeclare={async () => {
                  await transitionInnings(selectedMatch, true);
                }}
                onFollowOn={async () => {
                  await db.matches.update(selectedMatch.id, { 
                    is_follow_on: true, 
                    current_innings: 3,
                    current_striker_id: null,
                    non_striker_id: null,
                    current_bowler_id: null
                  });
                }}
                onShare={() => setShowShareModal(true)}
                onBack={() => {
                  if (selectedMatch.tournament_id) {
                    setShowTournament(true);
                  }
                  setSelectedMatchId(null);
                  setIsLiveView(false);
                }}
                showVictory={showVictory}
                setShowVictory={setShowVictory}
                setShowGlassBreak={setShowGlassBreak}
              />
            )
          ) : (
            <div className="flex items-center justify-center p-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
            </div>
          )
        ) : (selectedMatchId && selectedMatch) ? (
          <MatchDashboard 
            match={selectedMatch} 
            onBack={() => {
              if (selectedMatch.tournament_id) {
                setShowTournament(true);
              }
              setSelectedMatchId(null);
            }} 
            onUpdate={(updatedMatch) => {
              // updatedMatch is handled by Dexie's useLiveQuery
            }}
            onAddBall={addBall}
            onUndoLast={undoLast}
            onDeclare={async () => {
              await transitionInnings(selectedMatch, true);
            }}
            showVictory={showVictory}
            setShowVictory={setShowVictory}
            setShowGlassBreak={setShowGlassBreak}
          />
        ) : selectedMatchId ? (
          <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-6">
                <HistoryIcon size={16} className="text-neon-cyan" />
                <h2 className="font-serif italic text-lg text-neon-cyan/80">Live & Recent</h2>
              </div>
              
              {(matches || [])
                .filter(m => !m.tournament_id && (m.status === 'ongoing' || (Date.now() - new Date(m.created_at).getTime() < 86400000)))
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .length === 0 ? (
                <div className="border border-dashed border-neon-cyan/20 rounded-2xl p-16 text-center">
                  <p className="opacity-40 font-serif italic text-lg">The field is empty. Start a match.</p>
                </div>
              ) : (
                <div className="border-t border-white/10">
                  {(matches || [])
                    .filter(m => !m.tournament_id && (m.status === 'ongoing' || (Date.now() - new Date(m.created_at).getTime() < 86400000)))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(match => (
                    <div 
                      key={match.id} 
                      onClick={() => setSelectedMatchId(match.id)}
                      className="data-grid-row group"
                    >
                      <div className="flex items-center justify-center">
                        <Circle size={12} className={match.status === 'ongoing' ? 'text-neon-cyan animate-pulse' : 'opacity-20'} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                          {match.team_a_icon ? (
                            <img src={match.team_a_icon} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/20">A</div>
                          )}
                          <span className="font-bold text-lg tracking-tight group-hover:text-brutal-black">{match.team_a_name} vs {match.team_b_name}</span>
                          {match.team_b_icon ? (
                            <img src={match.team_b_icon} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/20">B</div>
                          )}
                        </div>
                        <span className="text-[9px] opacity-40 uppercase font-mono tracking-widest group-hover:text-brutal-black/60">
                          {match.tournament_name || 'Friendly'} • {new Date(match.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center data-value text-neon-cyan group-hover:text-brutal-black">
                        {match.total_overs} OVERS
                      </div>
                      <div className="flex items-center justify-end">
                        <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showSetup && (
          <MatchSetupModal 
            onClose={() => setShowSetup(false)} 
            onSubmit={createMatch}
          />
        )}
        {showShareModal && selectedMatchId && (
          <ShareModal 
            matchId={selectedMatchId}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </AnimatePresence>
      </motion.div>
  );
}




function MatchSetupModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (a: number, b: number, o: number, w: number, mt: 'test' | 'odi' | 't20', iconA?: string, iconB?: string) => void }) {
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [teamAPlayers, setTeamAPlayers] = useState<{name: string, isCaptain: boolean}[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<{name: string, isCaptain: boolean}[]>([]);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [overs, setOvers] = useState('20');
  const [wickets, setWickets] = useState('10');
  const [step, setStep] = useState<'match_type' | 'team_a' | 'players_a' | 'team_b' | 'players_b' | 'overs' | 'wickets'>('match_type');

  useEffect(() => {
    if (step === 'wickets' && teamAPlayers.length > 0) {
      setWickets((teamAPlayers.length - 1).toString());
    }
  }, [step, teamAPlayers.length]);

  const [matchType, setMatchType] = useState<'test' | 'odi' | 't20' | 'customize'>('t20');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<'teamA' | 'teamB' | 'player'>('teamA');

  useEffect(() => {
    if (matchType === 'test') setOvers('90');
    else if (matchType === 'odi') setOvers('50');
    else if (matchType === 't20') setOvers('20');
  }, [matchType]);

  const handleNext = () => {
    if (step === 'match_type') setStep('team_a');
    else if (step === 'team_a') setStep('players_a');
    else if (step === 'players_a') setStep('team_b');
    else if (step === 'team_b') setStep('players_b');
    else if (step === 'players_b') {
      if (matchType === 'customize') setStep('wickets');
      else setStep('overs');
    }
    else if (step === 'wickets') setStep('overs');
  };

  const handleBack = () => {
    if (step === 'team_a') setStep('match_type');
    else if (step === 'players_a') setStep('team_a');
    else if (step === 'team_b') setStep('players_a');
    else if (step === 'players_b') setStep('team_b');
    else if (step === 'overs') {
      if (matchType === 'customize') setStep('wickets');
      else setStep('players_b');
    }
    else if (step === 'wickets') setStep('players_b');
  };

  const addPlayer = () => {
    if (!currentPlayerName) return;
    const isFirstPlayer = (step === 'players_a' ? teamAPlayers : teamBPlayers).length === 0;
    const newPlayer = { name: currentPlayerName, isCaptain: isFirstPlayer };
    if (step === 'players_a') {
      setTeamAPlayers([...teamAPlayers, newPlayer]);
    } else {
      setTeamBPlayers([...teamBPlayers, newPlayer]);
    }
    setCurrentPlayerName('');
  };

  const toggleCaptain = (index: number) => {
    if (step === 'players_a') {
      setTeamAPlayers(teamAPlayers.map((p, i) => ({ ...p, isCaptain: i === index })));
    } else {
      setTeamBPlayers(teamBPlayers.map((p, i) => ({ ...p, isCaptain: i === index })));
    }
  };

  const [teamAIcon, setTeamAIcon] = useState<string | undefined>();
  const [teamBIcon, setTeamBIcon] = useState<string | undefined>();

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>, team: 'a' | 'b') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) {
        alert('File size exceeds 500MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (team === 'a') setTeamAIcon(reader.result as string);
        else setTeamBIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    try {
      // 1. Create Team A
      const teamAId = await db.teams.add({
        name: teamAName,
        icon: teamAIcon,
        tournament_id: null,
        created_at: new Date().toISOString()
      } as any);
      
      // 2. Add Team A Players
      for (const p of teamAPlayers) {
        await db.players.add({
          team_id: teamAId as number,
          name: p.name,
          is_captain: p.isCaptain,
          isCaptain: p.isCaptain,
          created_at: new Date().toISOString()
        } as any);
      }

      // 3. Create Team B
      const teamBId = await db.teams.add({
        name: teamBName,
        icon: teamBIcon,
        tournament_id: null,
        created_at: new Date().toISOString()
      } as any);

      // 4. Add Team B Players
      for (const p of teamBPlayers) {
        await db.players.add({
          team_id: teamBId as number,
          name: p.name,
          is_captain: p.isCaptain,
          isCaptain: p.isCaptain,
          created_at: new Date().toISOString()
        } as any);
      }

      // 5. Create Match
      const matchTypeVal = matchType === 'customize' ? 't20' : matchType;
      const wicketCount = matchTypeVal === 'test' ? teamAPlayers.length - 1 : Number(wickets);
      const finalOvers = matchTypeVal === 'test' ? 450 : Number(overs);
      
      onSubmit(teamAId as number, teamBId as number, finalOvers, wicketCount, matchTypeVal, teamAIcon, teamBIcon);
    } catch (err) {
      console.error('Failed to setup match:', err);
    }
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
        <div className="flex justify-between items-center mb-8">
          <h2 className="font-serif text-4xl italic text-neon-cyan">Match Setup</h2>
          <div className="flex gap-1">
            {['match_type', 'team_a', 'players_a', 'team_b', 'players_b', 'wickets', 'overs'].map((s, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${step === s ? 'bg-neon-cyan' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        <div className="min-h-[300px]">
          {step === 'match_type' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="block text-[10px] uppercase font-mono mb-4 text-neon-cyan/60 tracking-widest">Select Match Type</label>
              <div className="grid grid-cols-2 gap-3">
                {['test', 'odi', 't20', 'customize'].map(m => (
                  <button 
                    key={m}
                    onClick={() => setMatchType(m as any)}
                    className={`py-4 rounded-xl border font-mono font-bold transition-all ${
                      matchType === m ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {(step === 'team_a' || step === 'team_b') && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="block text-[10px] uppercase font-mono mb-4 text-neon-cyan/60 tracking-widest">
                {step === 'team_a' ? 'Batting Team Name' : 'Bowling Team Name'}
              </label>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden bg-white/5 hover:border-neon-cyan/50 transition-all">
                    {(step === 'team_a' ? teamAIcon : teamBIcon) ? (
                      <img 
                        src={step === 'team_a' ? teamAIcon : teamBIcon} 
                        alt="Team Icon" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Plus className="text-white/20 group-hover:text-neon-cyan/50" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleIconUpload(e, step === 'team_a' ? 'a' : 'b')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div 
                  onClick={() => {
                    setKeyboardTarget(step === 'team_a' ? 'teamA' : 'teamB');
                    setShowKeyboard(true);
                  }}
                  className="flex-1 bg-white/5 border-b border-neon-cyan/30 py-4 font-bold text-2xl cursor-pointer min-h-[64px]"
                >
                  {(step === 'team_a' ? teamAName : teamBName) || <span className="opacity-20">Enter Team Name...</span>}
                </div>
              </div>
              <p className="text-[10px] text-white/40 font-mono italic">Upload team icon (Max 500MB)</p>
            </motion.div>
          )}

          {(step === 'players_a' || step === 'players_b') && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <label className="block text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest">
                {step === 'players_a' ? `Players for ${teamAName}` : `Players for ${teamBName}`}
              </label>
              
              <div className="flex gap-2">
                <div 
                  onClick={() => {
                    setKeyboardTarget('player');
                    setShowKeyboard(true);
                  }}
                  className="flex-1 bg-white/5 border-b border-neon-cyan/30 py-2 font-bold text-lg cursor-pointer min-h-[44px]"
                >
                  {currentPlayerName || <span className="opacity-20 text-sm">Player Name...</span>}
                </div>
                <button 
                  onClick={addPlayer}
                  className="px-4 bg-neon-cyan text-brutal-black rounded-lg font-black"
                >
                  ADD
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2">
                {(step === 'players_a' ? teamAPlayers : teamBPlayers).map((p, i) => (
                  <div key={`${p.name}-${i}`} className="bg-white/5 border border-white/10 p-2 rounded-lg text-sm flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleCaptain(i)} className={`w-4 h-4 rounded-full border ${p.isCaptain ? 'bg-neon-cyan border-neon-cyan' : 'border-white/30'}`} />
                      <span className="truncate">{p.name} {p.isCaptain && <span className="text-neon-cyan text-[10px] ml-1">(C)</span>}</span>
                    </div>
                    <button 
                      onClick={() => {
                        if (step === 'players_a') setTeamAPlayers(prev => prev.filter((_, idx) => idx !== i));
                        else setTeamBPlayers(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      className="text-red-500 ml-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] opacity-40 uppercase font-mono">Total: {(step === 'players_a' ? teamAPlayers : teamBPlayers).length} Players</p>
            </motion.div>
          )}

          {step === 'wickets' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="block text-[10px] uppercase font-mono mb-4 text-neon-cyan/60 tracking-widest">Wickets</label>
              <input 
                type="number" 
                value={wickets} 
                onChange={(e) => setWickets(e.target.value)} 
                className="w-full bg-white/5 border-b border-neon-cyan/30 py-4 font-bold text-2xl"
              />
            </motion.div>
          )}

          {step === 'overs' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="block text-[10px] uppercase font-mono mb-4 text-neon-cyan/60 tracking-widest">Match Duration (Overs)</label>
              {matchType === 'customize' ? (
                <input 
                  type="number"
                  value={overs}
                  onChange={(e) => setOvers(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl font-mono text-xl"
                  placeholder="Enter overs"
                />
              ) : (
                <div className="text-2xl font-bold text-neon-cyan">
                  {matchType === 'test' ? '90' : matchType === 'odi' ? '50' : '20'} Overs
                </div>
              )}
            </motion.div>
          )}
        </div>

        <div className="mt-10 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 border border-white/10 rounded-2xl uppercase text-[10px] font-black tracking-[0.2em] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          {step === 'overs' ? (
            <button 
              onClick={handleSubmit}
              disabled={!teamAName || !teamBName || teamAPlayers.length === 0 || teamBPlayers.length === 0}
              className="flex-1 py-4 bg-neon-cyan text-brutal-black rounded-2xl uppercase text-[10px] font-black tracking-[0.2em] hover:brightness-110 disabled:opacity-20 transition-all shadow-[0_0_30px_rgba(0,255,255,0.3)]"
            >
              Start Match
            </button>
          ) : (
            <button 
              onClick={handleNext}
              disabled={
                (step === 'team_a' && !teamAName) || 
                (step === 'team_b' && !teamBName) ||
                (step === 'players_a' && teamAPlayers.length === 0) ||
                (step === 'players_b' && teamBPlayers.length === 0)
              }
              className="flex-1 py-4 bg-neon-cyan text-brutal-black rounded-2xl uppercase text-[10px] font-black tracking-[0.2em] hover:brightness-110 disabled:opacity-20 transition-all"
            >
              Next
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showKeyboard && (
          <VirtualKeyboard 
            onKeyPress={(k) => {
              if (keyboardTarget === 'teamA') setTeamAName(prev => prev + k);
              else if (keyboardTarget === 'teamB') setTeamBName(prev => prev + k);
              else setCurrentPlayerName(prev => prev + k);
            }}
            onBackspace={() => {
              if (keyboardTarget === 'teamA') setTeamAName(prev => prev.slice(0, -1));
              else if (keyboardTarget === 'teamB') setTeamBName(prev => prev.slice(0, -1));
              else setCurrentPlayerName(prev => prev.slice(0, -1));
            }}
            onClear={() => {
              if (keyboardTarget === 'teamA') setTeamAName('');
              else if (keyboardTarget === 'teamB') setTeamBName('');
              else setCurrentPlayerName('');
            }}
            onClose={() => setShowKeyboard(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MatchDashboard({ match, onBack, onUpdate, onAddBall, onUndoLast, onDeclare, isLiveView, showVictory, setShowVictory, setShowGlassBreak }: { match: Match, onBack: () => void, onUpdate: (m: Match) => void, onAddBall: typeof addBall, onUndoLast: typeof undoLast, onDeclare: (m: Match) => void, isLiveView?: boolean, showVictory: boolean, setShowVictory: (v: boolean) => void, setShowGlassBreak: (v: boolean) => void }) {
  console.log('MatchDashboard match:', match);
  const balls = useLiveQuery(() => db.balls.where('match_id').equals(match.id).toArray(), [match.id]) || [];
  const [showBatsmanSelect, setShowBatsmanSelect] = useState(false);
  const [showNonStrikerSelect, setShowNonStrikerSelect] = useState(false);
  const [showBowlerSelect, setShowBowlerSelect] = useState(false);
  const [showInningsSetup, setShowInningsSetup] = useState(!match.current_striker_id || !match.current_bowler_id);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showWicketSelect, setShowWicketSelect] = useState(false);
  const [wicketType, setWicketType] = useState<string | null>(null);
  const [batsmanOutId, setBatsmanOutId] = useState<string | null>(null);
  const [showNextBatsmanSelect, setShowNextBatsmanSelect] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [lastSelectedOver, setLastSelectedOver] = useState<number>(-1);
  const [currentBatsmanId, setCurrentBatsmanId] = useState<string | null>(match.current_striker_id || null);
  const [currentBowlerId, setCurrentBowlerId] = useState<string | null>(match.current_bowler_id || null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(match.non_striker_id || null);
  const [wasAlreadyFinished] = useState(match.status === 'finished');

  useEffect(() => {
    if (!match.current_striker_id || !match.current_bowler_id) {
      setShowInningsSetup(true);
    }
  }, [match.current_striker_id, match.current_bowler_id]);

  const [pendingExtra, setPendingExtra] = useState<'wide' | 'noball' | 'bye' | 'legbye' | null>(null);

  const teamAPlayers = useLiveQuery(() => db.players.where('team_id').equals(match.team_a_id).toArray(), [match.team_a_id]) || [];
  const teamBPlayers = useLiveQuery(() => db.players.where('team_id').equals(match.team_b_id).toArray(), [match.team_b_id]) || [];

  const { battingTeamName, bowlingTeamName, battingPlayers, bowlingPlayers } = useMemo(() => {
    let battingTeamName, bowlingTeamName, battingPlayers, bowlingPlayers;
    
    const isTeamABattingFirst = (match.toss_winner_id === match.team_a_id && match.toss_decision === 'bat') ||
                               (match.toss_winner_id === match.team_b_id && match.toss_decision === 'bowl');
    
    let teamABatsInInnings = match.current_innings % 2 !== 0 ? isTeamABattingFirst : !isTeamABattingFirst;
    
    if (match.is_follow_on && (match.current_innings === 3 || match.current_innings === 4)) {
      teamABatsInInnings = !teamABatsInInnings;
    }

    if (teamABatsInInnings) {
      battingTeamName = match.team_a_name;
      bowlingTeamName = match.team_b_name;
      battingPlayers = match.players?.team_a || teamAPlayers;
      bowlingPlayers = match.players?.team_b || teamBPlayers;
    } else {
      battingTeamName = match.team_b_name;
      bowlingTeamName = match.team_a_name;
      battingPlayers = match.players?.team_b || teamBPlayers;
      bowlingPlayers = match.players?.team_a || teamAPlayers;
    }

    return { battingTeamName, bowlingTeamName, battingPlayers, bowlingPlayers };
  }, [match, teamAPlayers, teamBPlayers]);

  // Derived stats
  const stats = useMemo(() => {
    let totalRuns = 0;
    let totalWickets = 0;
    let totalBalls = 0;
    let extras = 0;

    const currentInningsBalls = balls.filter(b => b.innings_no === match.current_innings);

    currentInningsBalls.forEach(b => {
      totalRuns += Number(b.runs || 0) + Number(b.extra_runs || 0);
      if (b.wicket_type && b.wicket_type !== 'retired_hurt') totalWickets++;
      if (b.extra_type !== 'wide' && b.extra_type !== 'noball') {
        totalBalls++;
      }
      extras += Number(b.extra_runs || 0);
    });

    const overs = Math.floor(totalBalls / 6);
    const remainingBalls = totalBalls % 6;
    const runRate = totalBalls > 0 ? (totalRuns / (totalBalls / 6)).toFixed(2) : '0.00';
    
    // Test match specific stats
    const totalMatchBalls = balls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'noball').length;
    const day = Math.floor(totalMatchBalls / (90 * 6)) + 1;
    const ballsInDay = totalMatchBalls % (90 * 6);
    let session = 'Morning';
    let sessionStatus = 'In Progress';
    
    if (ballsInDay >= 30 * 6 && ballsInDay < 32 * 6) {
      session = 'Lunch Break';
      sessionStatus = 'Break';
    } else if (ballsInDay >= 32 * 6 && ballsInDay < 60 * 6) {
      session = 'Afternoon';
    } else if (ballsInDay >= 60 * 6 && ballsInDay < 62 * 6) {
      session = 'Tea Break';
      sessionStatus = 'Break';
    } else if (ballsInDay >= 62 * 6) {
      session = 'Evening';
    }

    if (day > 5) {
      session = 'Stumps';
      sessionStatus = 'Match Ended';
    }
    
    // Calculate RRR for 2nd/4th innings
    let requiredRunRate = '0.00';
    let target = 0;
    let lead = 0;
    let trail = 0;
    let matchStatusText = '';
    
    const innings1Runs = balls.filter(b => b.innings_no === 1).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
    const innings2Runs = balls.filter(b => b.innings_no === 2).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
    const innings3Runs = balls.filter(b => b.innings_no === 3).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
    const innings4Runs = balls.filter(b => b.innings_no === 4).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);

    if (match.match_type === 'test') {
      if (match.current_innings === 1) {
        lead = totalRuns;
        matchStatusText = `${battingTeamName} batting 1st`;
      } else if (match.current_innings === 2) {
        trail = Math.max(0, innings1Runs - totalRuns);
        lead = Math.max(0, totalRuns - innings1Runs);
        matchStatusText = trail > 0 ? `${battingTeamName} trail by ${trail} runs` : `${battingTeamName} lead by ${lead} runs`;
      } else if (match.current_innings === 3) {
        if (match.is_follow_on) {
          const teamBTotal = innings2Runs + totalRuns;
          if (teamBTotal > innings1Runs) {
            lead = teamBTotal - innings1Runs;
            matchStatusText = `${battingTeamName} lead by ${lead} runs`;
          } else {
            trail = innings1Runs - teamBTotal;
            matchStatusText = `${battingTeamName} trail by ${trail} runs (Follow-on)`;
          }
        } else {
          const teamATotal = innings1Runs + totalRuns;
          if (teamATotal > innings2Runs) {
            lead = teamATotal - innings2Runs;
            matchStatusText = `${battingTeamName} lead by ${lead} runs`;
          } else {
            trail = innings2Runs - teamATotal;
            matchStatusText = `${battingTeamName} trail by ${trail} runs`;
          }
        }
      } else if (match.current_innings === 4) {
        let targetRuns = 0;
        if (match.is_follow_on) {
          targetRuns = (innings2Runs + innings3Runs) - innings1Runs + 1;
        } else {
          targetRuns = (innings1Runs + innings3Runs) - innings2Runs + 1;
        }
        target = targetRuns;
        trail = Math.max(0, targetRuns - totalRuns);
        matchStatusText = totalRuns >= targetRuns ? `${battingTeamName} won` : `${battingTeamName} need ${trail} runs to win`;
        
        const remainingBallsMatch = (450 * 6) - totalMatchBalls; // Rough estimate for Test match
        if (remainingBallsMatch > 0) {
          requiredRunRate = (trail / (remainingBallsMatch / 6)).toFixed(2);
        }
      }
    } else {
      if (match.current_innings === 1) {
        lead = totalRuns;
        matchStatusText = `1st Innings`;
      } else if (match.current_innings === 2) {
        target = innings1Runs + 1;
        trail = Math.max(0, target - totalRuns);
        matchStatusText = `Need ${trail} runs from ${Math.max(0, match.total_overs * 6 - totalBalls)} balls`;
        const remainingOvers = (match.total_overs * 6 - totalBalls) / 6;
        if (remainingOvers > 0) {
          requiredRunRate = (trail / remainingOvers).toFixed(2);
        }
      }
    }

    // Follow-on check
    const canEnforceFollowOn = match.match_type === 'test' && 
                               match.current_innings === 2 && 
                               (totalWickets >= match.wickets || match.is_declared) && 
                               innings1Runs - totalRuns >= 200;

    const playerStats = calculatePlayerStats(balls, [...battingPlayers, ...bowlingPlayers]);

    return { 
      totalRuns, totalWickets, overs, remainingBalls, runRate, requiredRunRate, 
      extras, totalBalls, target, currentInningsBalls, day, session, sessionStatus, 
      lead, trail, canEnforceFollowOn, playerStats, matchStatusText
    };
  }, [balls, match, battingPlayers, bowlingPlayers]);

  const handleAddBall = async (ballData: Partial<Ball>, overrideBatsmanId?: string | null) => {
    const runs = ballData.runs || 0;
    const isLegalBall = ballData.extra_type !== 'wide' && ballData.extra_type !== 'noball';
    
    const bId = overrideBatsmanId !== undefined ? overrideBatsmanId : currentBatsmanId;
    const batsmanName = battingPlayers?.find(p => p.id === bId)?.name;
    const bowlerName = bowlingPlayers?.find(p => p.id === currentBowlerId)?.name;
    
    if (ballData.runs === 6) {
      setShowGlassBreak(true);
    }

    await onAddBall(match.id, match.current_innings, stats.totalBalls, bId?.toString() || null, currentBowlerId?.toString() || null, ballData, batsmanName, bowlerName);

    // Strike rotation logic
    let shouldSwap = false;
    if (runs === 1 || runs === 3 || runs === 5) {
      shouldSwap = true;
    }

    // Over end rotation
    let newStrikerId = currentBatsmanId;
    let newNonStrikerId = nonStrikerId;

    if (isLegalBall && (stats.totalBalls + 1) % 6 === 0) {
      shouldSwap = !shouldSwap;
    }

    if (shouldSwap) {
      newStrikerId = nonStrikerId;
      newNonStrikerId = currentBatsmanId;
      setCurrentBatsmanId(newStrikerId);
      setNonStrikerId(newNonStrikerId);
    }

    // Persist current state to match
    try {
      await db.matches.update(match.id, {
        current_striker_id: newStrikerId,
        non_striker_id: newNonStrikerId,
        current_bowler_id: currentBowlerId
      });
    } catch (err) {
      console.error('Failed to update match state:', err);
    }
  };

  const handleUndo = () => {
    onUndoLast(match.id, balls);
  };

  useEffect(() => {
    if (match.current_striker_id) setCurrentBatsmanId(match.current_striker_id);
    if (match.current_bowler_id) setCurrentBowlerId(match.current_bowler_id);
    if (match.non_striker_id) setNonStrikerId(match.non_striker_id);
  }, [match.current_striker_id, match.current_bowler_id, match.non_striker_id]);

  // Reset lastSelectedOver when innings changes
  useEffect(() => {
    setLastSelectedOver(-1);
  }, [match.current_innings]);

  // Initialize lastSelectedOver if already in a match
  useEffect(() => {
    if (match.current_bowler_id && lastSelectedOver === -1) {
      const currentOver = Math.floor(stats.totalBalls / 6);
      const lastBall = balls[balls.length - 1];
      const isNewBowlerSelected = lastBall && lastBall.bowler_id !== match.current_bowler_id;

      if (stats.remainingBalls > 0 || isNewBowlerSelected) {
        setLastSelectedOver(currentOver);
      } else if (stats.totalBalls > 0) {
        setLastSelectedOver(currentOver - 1);
      } else {
        setLastSelectedOver(0); // Initial bowler
      }
    }
  }, [match.current_bowler_id, stats.totalBalls, stats.remainingBalls, lastSelectedOver, balls]);

  const isInningsOver = stats.totalWickets >= match.wickets || 
                        (match.match_type !== 'test' && stats.totalBalls >= match.total_overs * 6) ||
                        match.is_declared;
  
  const isMatchOver = useMemo(() => {
    if (match.match_type === 'test') {
      // Day 5 ended
      if (stats.day > 5) return true;
      
      // 4th innings finished
      if (match.current_innings === 4) {
        return stats.totalWickets >= match.wickets || (stats.target > 0 && stats.totalRuns >= stats.target) || match.is_declared;
      }
      
      // Innings win check (3rd innings finished and team still trails)
      if (match.current_innings === 3 && (stats.totalWickets >= match.wickets || match.is_declared)) {
        return stats.trail > 0;
      }
      
      return false;
    } else {
      return match.current_innings === 2 && 
             ((stats.target > 0 && stats.totalRuns >= stats.target) || stats.totalWickets >= match.wickets || stats.totalBalls >= match.total_overs * 6);
    }
  }, [match, stats]);

  // Check if we need to select batsman or bowler
  useEffect(() => {
    if (!match.toss_winner_id) return;
    
    // Bowler selection at start of over
    const currentOver = Math.floor(stats.totalBalls / 6);
    if (stats.remainingBalls === 0 && stats.totalBalls > 0 && stats.totalBalls % 6 === 0 && 
        !showBowlerSelect && !isInningsOver && lastSelectedOver < currentOver) {
      setShowBowlerSelect(true);
    }
    
    // Automatic victory trigger
    const triggerVictory = async () => {
      if (isMatchOver && !showVictory && !wasAlreadyFinished) {
        await onDeclare(match);
        setShowVictory(true);
      }
    };
    triggerVictory();
  }, [stats.remainingBalls, stats.totalBalls, showBowlerSelect, isInningsOver, isMatchOver, showVictory, wasAlreadyFinished, lastSelectedOver, onDeclare, match]);

  const handleSetupComplete = async (batsman1: string, batsman2: string, bowler: string) => {
    setCurrentBatsmanId(batsman1);
    setNonStrikerId(batsman2);
    setCurrentBowlerId(bowler);
    setLastSelectedOver(0);
    setShowInningsSetup(false);
    
    try {
      await db.matches.update(match.id, {
        current_striker_id: batsman1,
        non_striker_id: batsman2,
        current_bowler_id: bowler
      });
    } catch (err) {
      console.error('Failed to update match setup:', err);
    }
  };

  const handleTossComplete = async (winnerId: string, decision: 'bat' | 'bowl') => {
    try {
      await db.matches.update(match.id, {
        toss_winner_id: winnerId,
        toss_decision: decision
      });
    } catch (err) {
      console.error('Failed to update toss:', err);
    }
  };

  // Scoring handlers are now passed as props

  const switchInnings = async () => {
    try {
      await transitionInnings(match, true);
      if (match.current_innings < 4) {
        setCurrentBatsmanId(null);
        setNonStrikerId(null);
        setCurrentBowlerId(null);
        setShowInningsSetup(true);
      } else {
        setShowVictory(true);
      }
    } catch (err) {
      console.error('Failed to switch innings:', err);
    }
  };

  if (!match.toss_winner_id) {
    return <TossModal match={match} onComplete={handleTossComplete} />;
  }

  if (showVictory && !showScorecard) {
    let winnerName = 'Tie';
    if (match.winner_id && match.winner_id !== 'null') {
      winnerName = String(match.winner_id) === String(match.team_a_id) ? match.team_a_name : match.team_b_name;
    } else if (match.result_message) {
      if (match.result_message.includes('Drawn')) winnerName = 'Draw';
      else if (match.result_message.includes('Tied')) winnerName = 'Tie';
      else if (match.result_message.includes(match.team_a_name)) winnerName = match.team_a_name;
      else if (match.result_message.includes(match.team_b_name)) winnerName = match.team_b_name;
    }
    return <VictoryCelebration winnerName={winnerName} resultMessage={match.result_message} onBack={onBack} onViewScorecard={() => setShowScorecard(true)} />;
  }

  return (
    <div className="space-y-6">
      {showInningsSetup && !isInningsOver && !isMatchOver && match.status !== 'finished' && !isLiveView && (
        <MatchStartSetupModal 
          inningsNo={match.current_innings}
          battingTeamName={battingTeamName}
          bowlingTeamName={bowlingTeamName}
          battingPlayers={battingPlayers || []}
          bowlingPlayers={bowlingPlayers || []}
          onComplete={handleSetupComplete}
        />
      )}

      <div className="flex justify-between items-center">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity text-xs uppercase font-mono text-neon-cyan"
        >
          <Undo2 size={14} /> Back to Dashboard
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-neon-cyan border border-neon-cyan/30 px-4 py-1 rounded-full hover:bg-neon-cyan hover:text-brutal-black transition-all"
          >
            <Share2 size={12} /> Share Live URL
          </button>
          {match.status !== 'finished' && !isLiveView && (
            isMatchOver ? (
              <button 
                onClick={() => declareResult(match)}
                className="text-[10px] uppercase font-black tracking-widest text-neon-cyan border border-neon-cyan/30 px-4 py-1 rounded-full hover:bg-neon-cyan hover:text-brutal-black transition-all"
              >
                Declare Result
              </button>
            ) : match.match_type === 'test' && !isInningsOver ? (
              <button 
                onClick={async () => {
                  await db.matches.update(match.id, { is_declared: true });
                }}
                className="text-[10px] uppercase font-black tracking-widest text-red-500 border border-red-500/30 px-4 py-1 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                Declare Innings
              </button>
            ) : isInningsOver ? (
              <div className="flex gap-2">
                {stats.canEnforceFollowOn && (
                  <button 
                    onClick={async () => {
                      await db.matches.update(match.id, { is_follow_on: true });
                      await switchInnings();
                    }}
                    className="text-[10px] uppercase font-black tracking-widest text-red-500 border border-red-500/30 px-4 py-1 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                  >
                    Enforce Follow-On
                  </button>
                )}
                <button 
                  onClick={switchInnings}
                  className="text-[10px] uppercase font-black tracking-widest text-neon-cyan border border-neon-cyan/30 px-4 py-1 rounded-full hover:bg-neon-cyan hover:text-brutal-black transition-all"
                >
                  Start Next Innings
                </button>
              </div>
            ) : (
            <button 
              onClick={() => onDeclare(match)}
              className="text-[10px] uppercase font-black tracking-widest text-red-500 border border-red-500/30 px-4 py-1 rounded-full hover:bg-red-500 hover:text-white transition-all"
            >
              Finish Match Early
            </button>
          ))}
        </div>
      </div>

      <div className="bg-neon-cyan/5 border border-neon-cyan/20 p-3 rounded-xl flex items-center gap-3">
        <div className="w-6 h-6 bg-neon-cyan/20 rounded-full flex items-center justify-center">
          <Circle size={10} className="text-neon-cyan" />
        </div>
        <p className="text-[10px] uppercase font-mono tracking-widest text-neon-cyan/80">
          Toss: <span className="text-neon-cyan font-bold">{match.toss_winner_id === match.team_a_id ? match.team_a_name : match.team_b_name}</span> won and chose to <span className="text-neon-cyan font-bold">{match.toss_decision}</span>. 
          <span className="text-white/60"> 1st Team: {match.team_a_name} | 2nd Team: {match.team_b_name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Display */}
        <div className="md:col-span-2 hardware-widget p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy size={120} />
          </div>
          
          <div className="flex justify-between items-start z-10">
            <div>
              <div className="flex items-center gap-2">
                {match.team_a_icon && <span className="text-2xl">{match.team_a_icon}</span>}
                <h3 className="font-serif italic text-xl text-neon-cyan/80">{battingTeamName} <span className="text-xs font-sans not-italic text-white/40 uppercase tracking-widest ml-2">Innings {match.current_innings}</span></h3>
                {match.team_b_icon && <span className="text-2xl">{match.team_b_icon}</span>}
              </div>
              {match.match_type === 'test' && (
                <div className="flex gap-4 mt-1">
                  <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest">Day {stats.day}</div>
                  <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest">{stats.session}</div>
                  <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest">
                    {stats.matchStatusText}
                  </div>
                </div>
              )}
              <div className="flex items-baseline gap-4 mt-2">
                <span className="text-8xl font-black tracking-tighter text-white">{stats.totalRuns}</span>
                <span className="text-5xl font-light text-white/40">/ {stats.totalWickets}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <button onClick={() => setShowBatsmanSelect(true)} disabled={match.status === 'finished' || isLiveView} className="block w-full text-left group">
                    <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mb-1 group-hover:text-neon-cyan transition-colors">Striker</div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10 group-hover:border-neon-cyan/50 transition-colors">
                      <span className="font-bold truncate mr-2">{battingPlayers?.find(p => p.id === currentBatsmanId)?.name || 'Select'}</span>
                      <span className="text-neon-cyan font-mono">
                        {stats.playerStats[String(currentBatsmanId)]?.runs || 0} ({stats.playerStats[String(currentBatsmanId)]?.balls || 0})
                      </span>
                    </div>
                  </button>
                  <button onClick={() => setShowNonStrikerSelect(true)} disabled={match.status === 'finished' || isLiveView} className="block w-full text-left group">
                    <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mb-1 group-hover:text-neon-cyan transition-colors">Non-Striker</div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10 group-hover:border-neon-cyan/50 transition-colors">
                      <span className="font-bold truncate mr-2">{battingPlayers?.find(p => p.id === nonStrikerId)?.name || 'Select'}</span>
                      <span className="text-white/60 font-mono">
                        {stats.playerStats[String(nonStrikerId)]?.runs || 0} ({stats.playerStats[String(nonStrikerId)]?.balls || 0})
                      </span>
                    </div>
                  </button>
                </div>
                <div className="space-y-2">
                  <button onClick={() => setShowBowlerSelect(true)} disabled={match.status === 'finished' || isLiveView} className="block w-full text-left group">
                    <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mb-1 group-hover:text-neon-cyan transition-colors">Bowling</div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10 group-hover:border-neon-cyan/50 transition-colors">
                      <span className="font-bold truncate mr-2">{bowlingPlayers?.find(p => p.id === currentBowlerId)?.name || 'Select'}</span>
                      <div className="text-right">
                        <div className="text-neon-cyan font-mono leading-none">
                          {stats.playerStats[String(currentBowlerId)]?.wickets || 0} - {stats.playerStats[String(currentBowlerId)]?.runsConceded || 0}
                        </div>
                        <div className="text-[10px] font-mono text-white/40 mt-1">
                          {Math.floor((stats.playerStats[String(currentBowlerId)]?.ballsBowled || 0) / 6)}.{ (stats.playerStats[String(currentBowlerId)]?.ballsBowled || 0) % 6 } ov
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mb-1">Overs</div>
              <div className="text-4xl font-mono font-bold">{stats.overs}.{stats.remainingBalls}</div>
              <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mt-4 mb-1">Run Rate</div>
              <div className="text-2xl font-mono text-neon-cyan">{stats.runRate}</div>
              {stats.target > 0 && (
                <>
                  <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mt-4 mb-1">Target</div>
                  <div className="text-2xl font-mono text-neon-cyan">{stats.target}</div>
                  <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mt-4 mb-1">Req Run Rate</div>
                  <div className="text-2xl font-mono text-neon-cyan">{stats.requiredRunRate}</div>
                </>
              )}
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10 flex gap-4 overflow-x-auto pb-2 z-10">
            {stats.currentInningsBalls.slice(-6).map((b, i) => (
              <div key={b.id} className={`w-12 h-12 rounded-full flex items-center justify-center font-mono text-lg font-bold border-2 shrink-0 ${
                b.wicket_type ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 
                b.runs === 4 ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' :
                b.runs === 6 ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' :
                'border-white/20 text-white/60 bg-white/5'
              }`}>
                {b.wicket_type ? 'W' : b.extra_type === 'wide' ? 'wd' : b.extra_type === 'noball' ? 'nb' : b.runs}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 6 - stats.currentInningsBalls.slice(-6).length) }).map((_, i) => (
              <div key={`empty-${i}`} className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center opacity-20">
                <Circle size={12} />
              </div>
            ))}
          </div>

          <div className="mt-8">
            <WinPredictor 
              match={match} 
              stats={stats} 
              battingTeamName={battingTeamName} 
              bowlingTeamName={bowlingTeamName} 
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-col gap-6">
          <div className="bg-brutal-black border border-neon-cyan/30 rounded-xl p-6 flex flex-col justify-between shadow-lg">
            <div>
              <h4 className="col-header mb-4 text-neon-cyan">Innings Summary</h4>
              <div className="space-y-2">
                {match.match_type === 'test' ? (
                  <>
                    {[1, 2, 3, 4].map(i => {
                      const inningsBalls = balls.filter(b => b.innings_no === i);
                      const runs = inningsBalls.reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
                      const wickets = inningsBalls.filter(b => b.wicket_type && b.wicket_type !== 'retired_hurt').length;
                      if (i > match.current_innings) return null;
                      return (
                        <div key={i} className={`flex justify-between items-center border-b border-white/5 pb-1 ${match.current_innings === i ? 'text-neon-cyan' : 'opacity-60'}`}>
                          <span className="text-xs font-mono uppercase">Innings {i}</span>
                          <span className="font-bold">{runs}/{wickets}</span>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center border-b border-white/5 pb-1">
                      <span className="text-xs font-mono opacity-50 uppercase">Target</span>
                      <span className="font-bold">{stats.target > 0 ? stats.target : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-1">
                      <span className="text-xs font-mono opacity-50 uppercase">Extras</span>
                      <span className="font-bold text-neon-cyan">{stats.extras}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            {match.match_type !== 'test' && (
              <div className="mt-8">
                <div className="flex items-center gap-2 text-xs font-mono opacity-50 uppercase mb-2 text-neon-cyan">
                  <TrendingUp size={12} /> Projection
                </div>
                <div className="text-4xl font-black text-white">
                  {Math.round(parseFloat(stats.runRate) * match.total_overs)}
                </div>
                <div className="text-[10px] opacity-40 font-mono">Based on current RR</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scoring Controls */}
      {!isInningsOver && !isMatchOver && match.status !== 'finished' && !isLiveView && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-3 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3, 4, 6].map(r => (
              <div key={r} className="relative group">
                <button 
                  onClick={() => {
                    if (pendingExtra) {
                      if (pendingExtra === 'wide') {
                        handleAddBall({ runs: 0, extra_runs: r + 1, extra_type: 'wide' });
                      } else if (pendingExtra === 'noball') {
                        handleAddBall({ runs: r, extra_runs: 1, extra_type: 'noball' });
                      } else {
                        handleAddBall({ runs: 0, extra_runs: r, extra_type: pendingExtra });
                      }
                      setPendingExtra(null);
                    } else {
                      handleAddBall({ runs: r });
                    }
                  }}
                  className={`w-full h-20 border rounded-xl font-black text-3xl transition-all shadow-lg active:scale-95 ${
                    pendingExtra ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan' : 'bg-white/5 border-white/10 hover:bg-neon-cyan hover:text-brutal-black hover:border-neon-cyan'
                  }`}
                >
                  {pendingExtra ? `+${r}` : r}
                </button>
                {r === 0 && !pendingExtra && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddBall({ wicket_type: 'retired_hurt', runs: 0 });
                      setShowWicketSelect(true); // Trigger batsman selection
                    }}
                    className="absolute -top-2 -right-2 bg-orange-500 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg hover:bg-orange-600 transition-all z-10"
                  >
                    RET. HURT
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={() => {
                if (pendingExtra === 'wide') {
                  handleAddBall({ runs: 0, extra_runs: 1, extra_type: 'wide' });
                  setPendingExtra(null);
                } else {
                  setPendingExtra('wide');
                }
              }}
              className={`h-20 rounded-xl font-bold text-sm uppercase tracking-tighter transition-all border ${
                pendingExtra === 'wide' ? 'bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-orange-500/10 border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-white'
              }`}
            >
              Wide
            </button>
            <button 
              onClick={() => {
                if (pendingExtra === 'noball') {
                  handleAddBall({ runs: 0, extra_runs: 1, extra_type: 'noball' });
                  setPendingExtra(null);
                } else {
                  setPendingExtra('noball');
                }
              }}
              className={`h-20 rounded-xl font-bold text-sm uppercase tracking-tighter transition-all border ${
                pendingExtra === 'noball' ? 'bg-blue-500 text-white border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-blue-500/10 border-blue-500/50 text-blue-500 hover:bg-blue-500 hover:text-white'
              }`}
            >
              No Ball
            </button>
            <button 
              onClick={() => setPendingExtra(pendingExtra ? null : 'wide')}
              className={`h-20 rounded-xl flex items-center justify-center transition-all border ${
                pendingExtra ? 'bg-neon-cyan text-brutal-black border-neon-cyan shadow-[0_0_15px_rgba(0,255,255,0.4)]' : 'bg-white/5 border-white/10 hover:border-neon-cyan text-neon-cyan'
              }`}
            >
              <Plus size={24} />
            </button>
            {pendingExtra && (
              <div className="col-span-4 grid grid-cols-2 gap-2 mt-1 animate-in fade-in slide-in-from-top-2">
                <button 
                  onClick={() => setPendingExtra('bye')}
                  className={`py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest border transition-all ${pendingExtra === 'bye' ? 'bg-white text-brutal-black border-white' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'}`}
                >
                  Bye
                </button>
                <button 
                  onClick={() => setPendingExtra('legbye')}
                  className={`py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest border transition-all ${pendingExtra === 'legbye' ? 'bg-white text-brutal-black border-white' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'}`}
                >
                  Leg Bye
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setShowWicketSelect(true)}
              className="flex-1 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-lg hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all active:scale-95"
            >
              WICKET
            </button>
            <button 
              onClick={handleUndo}
              className="h-14 border border-white/20 rounded-xl flex items-center justify-center gap-2 text-xs uppercase font-bold hover:bg-white/10 transition-all"
            >
              <Undo2 size={16} /> Undo Last
            </button>
            {match.match_type === 'test' && (
              <button 
                onClick={switchInnings}
                className="h-14 bg-yellow-600 text-white rounded-xl font-black uppercase tracking-widest text-lg hover:bg-yellow-700 transition-all"
              >
                Declare
              </button>
            )}
            {stats.canEnforceFollowOn && (
              <button 
                onClick={async () => {
                  await db.matches.update(match.id, { 
                    is_follow_on: true, 
                    current_innings: 3,
                    current_striker_id: null,
                    non_striker_id: null,
                    current_bowler_id: null
                  });
                  setCurrentBatsmanId(null);
                  setNonStrikerId(null);
                  setCurrentBowlerId(null);
                  setShowInningsSetup(true);
                }}
                className="h-14 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-lg hover:bg-purple-700 transition-all"
              >
                Follow-on
              </button>
            )}
          </div>
          <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-2">
            <button 
              onClick={() => setShowScorecard(true)}
              className="w-full h-20 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl font-black text-xl hover:bg-neon-cyan hover:text-brutal-black transition-all"
            >
              Scorecard
            </button>
            <button 
              onClick={() => setShowStatsModal(true)}
              className="w-full h-20 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl font-black text-xl hover:bg-neon-cyan hover:text-brutal-black transition-all"
            >
              View Stats
            </button>
          </div>
        </div>
      )}

      {showScorecard && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 p-4 overflow-y-auto">
          <button onClick={() => setShowScorecard(false)} className="text-neon-cyan mb-4">Close</button>
          <Scorecard 
            match={match} 
            balls={balls} 
            currentBatsmanId={currentBatsmanId} 
            nonStrikerId={nonStrikerId} 
            currentBowlerId={currentBowlerId} 
            teamAPlayers={teamAPlayers}
            teamBPlayers={teamBPlayers}
          />
        </div>
      )}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 p-4 overflow-y-auto">
          <button onClick={() => setShowStatsModal(false)} className="text-neon-cyan mb-4">Close</button>
          <PlayerStatsTable players={battingPlayers || []} stats={calculatePlayerStats(balls, battingPlayers || [])} title={`${battingTeamName} Stats`} />
          <PlayerStatsTable players={bowlingPlayers || []} stats={calculatePlayerStats(balls, bowlingPlayers || [])} title={`${bowlingTeamName} Stats`} />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h4 className="col-header mb-4 text-neon-cyan">Batting ({battingTeamName})</h4>
          <div className="space-y-2">
            {battingPlayers?.map(p => {
              const pStats = stats.playerStats[String(p.id)];
              const isOut = balls.some(b => b.batsman_id === p.id && b.wicket_type);

              if ((!pStats || pStats.balls === 0) && !isOut && p.id !== currentBatsmanId && p.id !== nonStrikerId) return null;

              return (
                <div key={p.id} className={`flex justify-between items-center p-2 rounded-lg ${p.id === currentBatsmanId ? 'bg-neon-cyan/10 border border-neon-cyan/30' : 'border border-transparent'}`}>
                  <div className="flex flex-col">
                    <span className={`font-bold ${p.id === currentBatsmanId ? 'text-neon-cyan' : 'text-white'}`}>
                      {p.name} {p.id === currentBatsmanId && '*'}
                    </span>
                    <span className="text-[10px] opacity-40 font-mono">
                      {isOut ? 'out' : 'not out'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-right font-mono text-xs">
                    <div className="w-8">
                      <div className="opacity-40 text-[8px] uppercase">R</div>
                      <div className="font-bold">{pStats?.runs || 0}</div>
                    </div>
                    <div className="w-8">
                      <div className="opacity-40 text-[8px] uppercase">B</div>
                      <div>{pStats?.balls || 0}</div>
                    </div>
                    <div className="w-8 hidden sm:block">
                      <div className="opacity-40 text-[8px] uppercase">4s</div>
                      <div>{pStats?.fours || 0}</div>
                    </div>
                    <div className="w-8 hidden sm:block">
                      <div className="opacity-40 text-[8px] uppercase">6s</div>
                      <div>{pStats?.sixes || 0}</div>
                    </div>
                    <div className="w-10">
                      <div className="opacity-40 text-[8px] uppercase">SR</div>
                      <div>{pStats?.strikeRate || '0.0'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h4 className="col-header mb-4 text-neon-cyan">Bowling ({bowlingTeamName})</h4>
          <div className="space-y-2">
            {bowlingPlayers?.map(p => {
              const pStats = stats.playerStats[String(p.id)];
              if ((!pStats || pStats.ballsBowled === 0) && p.id !== currentBowlerId) return null;

              const overs = Math.floor((pStats?.ballsBowled || 0) / 6);
              const ballsInOver = (pStats?.ballsBowled || 0) % 6;

              return (
                <div key={p.id} className={`flex justify-between items-center p-2 rounded-lg ${p.id === currentBowlerId ? 'bg-neon-cyan/10 border border-neon-cyan/30' : 'border border-transparent'}`}>
                  <div className="flex flex-col">
                    <span className={`font-bold ${p.id === currentBowlerId ? 'text-neon-cyan' : 'text-white'}`}>
                      {p.name} {p.id === currentBowlerId && '*'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-right font-mono text-xs">
                    <div className="w-8">
                      <div className="opacity-40 text-[8px] uppercase">O</div>
                      <div className="font-bold">{overs}.{ballsInOver}</div>
                    </div>
                    <div className="w-8">
                      <div className="opacity-40 text-[8px] uppercase">M</div>
                      <div>0</div>
                    </div>
                    <div className="w-8">
                      <div className="opacity-40 text-[8px] uppercase">R</div>
                      <div>{pStats?.runsConceded || 0}</div>
                    </div>
                    <div className="w-8">
                      <div className="opacity-40 text-[8px] uppercase">W</div>
                      <div className="font-bold text-neon-cyan">{pStats?.wickets || 0}</div>
                    </div>
                    <div className="w-10">
                      <div className="opacity-40 text-[8px] uppercase">E</div>
                      <div>{pStats?.economy || '0.0'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ball History */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
          <h4 className="col-header text-neon-cyan">Ball-by-Ball Timeline</h4>
          <span className="text-[10px] font-mono opacity-50 uppercase">Recent first</span>
        </div>
        <div className="space-y-2">
          {balls.slice().reverse().map((b, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={b.id} 
              className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-xl text-sm hover:border-neon-cyan/30 transition-colors"
            >
              <span className="font-mono text-[10px] opacity-40 w-12">{b.over_no}.{b.ball_no}</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                b.wicket_type ? 'bg-red-600 text-white' : 'bg-brutal-black border border-white/20 text-white'
              }`}>
                {b.wicket_type ? 'W' : b.runs + b.extra_runs}
              </div>
              <div className="flex-1 flex flex-col">
                <span className="font-bold text-white">
                  {b.wicket_type ? (
                    <span className="text-red-500 uppercase tracking-wider">Wicket! ({b.wicket_type})</span>
                  ) : b.extra_type ? (
                    <span className="opacity-80 italic text-neon-cyan">{b.extra_type.toUpperCase()} +{b.extra_runs}</span>
                  ) : (
                    <span>{b.runs} runs</span>
                  )}
                </span>
                <span className="text-[10px] opacity-40 font-mono">
                  {b.batsman_name || 'Unknown'} vs {b.bowler_name || 'Unknown'}
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-30">{new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {showBatsmanSelect && (
          <PlayerSelectModal 
            players={battingPlayers || []}
            onSelect={async (id) => {
              setCurrentBatsmanId(id);
              setShowBatsmanSelect(false);
              try {
                await db.matches.update(match.id, { current_striker_id: id });
              } catch (err) {
                console.error('Failed to update striker:', err);
              }
            }}
            title="Select Striker"
          />
        )}
        {showNonStrikerSelect && (
          <PlayerSelectModal 
            players={battingPlayers || []}
            onSelect={async (id) => {
              setNonStrikerId(id);
              setShowNonStrikerSelect(false);
              try {
                await db.matches.update(match.id, { non_striker_id: id });
              } catch (err) {
                console.error('Failed to update non-striker:', err);
              }
            }}
            title="Select Non-Striker"
          />
        )}
        {showBowlerSelect && (
          <PlayerSelectModal 
            players={bowlingPlayers || []}
            onSelect={async (id) => {
              setCurrentBowlerId(id);
              setShowBowlerSelect(false);
              setLastSelectedOver(Math.floor(stats.totalBalls / 6));
              try {
                await db.matches.update(match.id, { current_bowler_id: id });
              } catch (err) {
                console.error('Failed to update bowler:', err);
              }
            }}
            title="Select Bowler"
          />
        )}
        {showWicketSelect && (
          <WicketSelectModal 
            onSelect={async (type) => {
              if (!type) {
                setShowWicketSelect(false);
                return;
              }
              setWicketType(type);
              if (type !== 'Run Out') {
                setShowWicketSelect(false);
              }
              
              if (type === 'Run Out') {
                // For run out, we need to know who got out
              } else {
                // For other wickets, striker is out
                setBatsmanOutId(currentBatsmanId);
                setShowNextBatsmanSelect(true);
              }
            }}
            onRunOutSelect={(outId) => {
              setBatsmanOutId(outId);
              setShowNextBatsmanSelect(true);
              setShowWicketSelect(false);
            }}
            battingPlayers={battingPlayers || []}
            currentBatsmanId={currentBatsmanId}
            nonStrikerId={nonStrikerId}
            balls={balls}
          />
        )}
        {showNextBatsmanSelect && (
          <PlayerSelectModal 
            players={battingPlayers.filter(p => 
              p.id !== currentBatsmanId && 
              p.id !== nonStrikerId && 
              !balls.some(b => b.innings_no === match.current_innings && b.wicket_type && b.batsman_id === p.id)
            )}
            onCancel={async () => {
              // All out scenario
              setShowNextBatsmanSelect(false);
              await transitionInnings(match);
              setCurrentBatsmanId(null);
              setNonStrikerId(null);
              setCurrentBowlerId(null);
              setShowInningsSetup(true);
            }}
            onSelect={async (nextBatsmanId) => {
              const ballData: Partial<Ball> = { 
                runs: 0, 
                wicket_type: wicketType || undefined,
              };
              
              await handleAddBall(ballData, batsmanOutId || currentBatsmanId);
              
              let striker = currentBatsmanId;
              let nonStriker = nonStrikerId;
              
              if (batsmanOutId === currentBatsmanId) {
                striker = nextBatsmanId;
                setCurrentBatsmanId(nextBatsmanId);
              } else {
                nonStriker = nextBatsmanId;
                setNonStrikerId(nextBatsmanId);
              }

              // After wicket (not run out), striker changes
              if (wicketType !== 'Run Out') {
                const temp = striker;
                striker = nonStriker;
                nonStriker = temp;
                setCurrentBatsmanId(striker);
                setNonStrikerId(nonStriker);
              }

              setShowNextBatsmanSelect(false);
              setWicketType(null);
              setBatsmanOutId(null);
              
              try {
                await db.matches.update(match.id, {
                  current_striker_id: striker,
                  non_striker_id: nonStriker
                });
              } catch (err) {
                console.error('Failed to update wicket state:', err);
              }
            }}
            title="Who is coming next?"
          />
        )}
        {showShareModal && (
          <ShareModal 
            matchId={match.id}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WicketSelectModal({ 
  onSelect, 
  onRunOutSelect,
  battingPlayers, 
  currentBatsmanId, 
  nonStrikerId,
  balls
}: { 
  onSelect: (type: string) => void,
  onRunOutSelect: (outId: string) => void,
  battingPlayers: Player[],
  currentBatsmanId: string | null,
  nonStrikerId: string | null,
  balls: Ball[]
}) {
  const [showRunOutWho, setShowRunOutWho] = useState(false);
  const types = ['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket', 'Handled Ball', 'Timed Out'];
  
  const strikerName = battingPlayers.find(p => p.id === currentBatsmanId)?.name || 'Striker';
  const nonStrikerName = battingPlayers.find(p => p.id === nonStrikerId)?.name || 'Non-Striker';

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
        {!showRunOutWho ? (
          <>
            <h2 className="font-serif text-3xl mb-6 italic text-neon-cyan">Select Wicket Type</h2>
            <div className="grid grid-cols-2 gap-3">
              {types.map(t => (
                <button 
                  key={t}
                  onClick={() => {
                    if (t === 'Run Out') {
                      setShowRunOutWho(true);
                      onSelect(t);
                    } else {
                      onSelect(t);
                    }
                  }}
                  className="p-4 text-center border border-white/10 rounded-xl hover:bg-neon-cyan hover:text-brutal-black transition-all font-bold"
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => onSelect('')} className="w-full mt-4 py-2 text-white/40 uppercase text-[10px] tracking-widest">Cancel</button>
          </>
        ) : (
          <>
            <h2 className="font-serif text-3xl mb-6 italic text-neon-cyan">Who got out?</h2>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => onRunOutSelect(currentBatsmanId!)}
                className="p-4 text-left border border-white/10 rounded-xl hover:bg-neon-cyan hover:text-brutal-black transition-all font-bold"
              >
                {strikerName} (Striker)
              </button>
              <button 
                onClick={() => onRunOutSelect(nonStrikerId!)}
                className="p-4 text-left border border-white/10 rounded-xl hover:bg-neon-cyan hover:text-brutal-black transition-all font-bold"
              >
                {nonStrikerName} (Non-Striker)
              </button>
            </div>
            <button onClick={() => setShowRunOutWho(false)} className="w-full mt-4 py-2 text-white/40 uppercase text-[10px] tracking-widest">Back</button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function ShareModal({ matchId, onClose }: { matchId: string, onClose: () => void }) {
  const url = `${window.location.origin}/live/${matchId}`;
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
        <h2 className="font-serif text-3xl mb-4 italic text-neon-cyan">Share Live Scoreboard</h2>
        <p className="text-white/60 text-sm mb-6">Share this URL with players to view live scores on their phones.</p>
        
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
            {copied ? <Check size={16} /> : <Copy size={16} />}
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

function PlayerSelectModal({ players, onSelect, title, onCancel }: { players: Player[], onSelect: (id: string) => void, title: string, onCancel?: () => void }) {
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
        <h2 className="font-serif text-3xl mb-6 italic text-neon-cyan">{title}</h2>
        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {players.map(p => (
            <button 
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="p-4 text-left border border-white/10 rounded-xl hover:bg-neon-cyan hover:text-brutal-black transition-all group"
            >
              <span className="font-bold text-lg">{p.name}</span>
              {p.is_captain && <span className="ml-2 text-[10px] uppercase bg-white/10 px-2 py-1 rounded group-hover:bg-brutal-black/20">C</span>}
            </button>
          ))}
          {players.length === 0 && (
            <div className="text-center py-8 text-white/40 font-mono text-sm">
              No more players available
            </div>
          )}
        </div>
        {onCancel && (
          <button 
            onClick={onCancel} 
            className="w-full mt-6 py-3 text-white/40 uppercase text-[10px] tracking-[0.2em] font-bold hover:text-neon-cyan transition-colors"
          >
            {players.length === 0 ? 'End Innings' : 'Cancel'}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

function calculatePlayerStats(balls: Ball[], players: Player[]) {
  const stats: Record<string, { 
    runs: number, 
    balls: number, 
    fours: number, 
    sixes: number, 
    wickets: number, 
    runsConceded: number, 
    ballsBowled: number,
    overs: number, 
    economy: number,
    strikeRate: number 
  }> = {};
  
  players.forEach(p => {
    stats[String(p.id)] = { 
      runs: 0, 
      balls: 0, 
      fours: 0, 
      sixes: 0, 
      wickets: 0, 
      runsConceded: 0, 
      ballsBowled: 0,
      overs: 0, 
      economy: 0,
      strikeRate: 0 
    };
  });

  balls.forEach(b => {
    const bId = b.batsman_id ? String(b.batsman_id) : null;
    const bowId = b.bowler_id ? String(b.bowler_id) : null;
    
    if (bId && stats[bId]) {
      stats[bId].runs += Number(b.runs || 0);
      if (b.extra_type !== 'wide') {
        stats[bId].balls += 1;
      }
      if (Number(b.runs) === 4) stats[bId].fours += 1;
      if (Number(b.runs) === 6) stats[bId].sixes += 1;
    }
    
    if (bowId && stats[bowId]) {
      const totalRunsOnBall = Number(b.runs || 0) + Number(b.extra_runs || 0);
      stats[bowId].runsConceded += totalRunsOnBall;
      if (b.extra_type !== 'wide' && b.extra_type !== 'noball') {
        stats[bowId].ballsBowled += 1;
      }
      if (b.wicket_type && b.wicket_type !== 'Run Out' && b.wicket_type !== 'retired_hurt') stats[bowId].wickets += 1;
    }
  });

  Object.keys(stats).forEach(id => {
    const s = stats[id];
    s.overs = Math.floor(s.ballsBowled / 6) + (s.ballsBowled % 6) / 10;
    s.economy = s.ballsBowled > 0 ? parseFloat((s.runsConceded / (s.ballsBowled / 6)).toFixed(2)) : 0;
    s.strikeRate = s.balls > 0 ? parseFloat(((s.runs / s.balls) * 100).toFixed(1)) : 0;
  });

  return stats;
}

function WinPredictor({ match, stats, battingTeamName, bowlingTeamName }: { match: Match, stats: any, battingTeamName: string, bowlingTeamName: string }) {
  if (match.match_type === 'test') {
    if (match.current_innings !== 4) return null;
  } else {
    if (match.current_innings !== 2) return null;
  }
  
  const runsNeeded = stats.target - stats.totalRuns;
  const ballsRemaining = match.match_type === 'test' ? 999 : Math.max(0, (match.total_overs * 6) - stats.totalBalls);
  const wicketsRemaining = match.wickets - stats.totalWickets;
  
  if (runsNeeded <= 0 || (ballsRemaining <= 0 && runsNeeded > 0) || wicketsRemaining <= 0) {
    const battingWinProb = runsNeeded <= 0 ? 100 : 0;
    const bowlingWinProb = 100 - battingWinProb;
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brutal-black border border-neon-cyan/30 rounded-xl p-6 shadow-lg"
      >
        <div className="flex items-center gap-2 text-xs font-mono opacity-50 uppercase mb-4 text-neon-cyan">
          <TrendingUp size={12} /> Win Predictor
        </div>
        <div className="text-center font-black text-xl text-neon-cyan uppercase tracking-widest">
          {battingWinProb === 100 ? `${battingTeamName} Won!` : `${bowlingTeamName} Won!`}
        </div>
      </motion.div>
    );
  }

  const rrr = parseFloat(stats.requiredRunRate);
  const crr = parseFloat(stats.runRate);
  
  let battingWinProb = 50;
  
  // RRR impact
  const rrrDiff = crr - rrr;
  battingWinProb += rrrDiff * 8;
  
  // Wickets impact
  const wicketFactor = (wicketsRemaining / match.wickets) * 40;
  battingWinProb += (wicketFactor - 20);
  
  // Balls remaining impact (less balls = more pressure)
  if (ballsRemaining < 24) {
    battingWinProb -= (24 - ballsRemaining) * 0.5;
  }

  // Clamp between 1 and 99
  battingWinProb = Math.min(99, Math.max(1, Math.round(battingWinProb)));
  const bowlingWinProb = 100 - battingWinProb;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brutal-black border border-neon-cyan/30 rounded-xl p-6 shadow-lg"
    >
      <div className="flex items-center gap-2 text-xs font-mono opacity-50 uppercase mb-4 text-neon-cyan">
        <TrendingUp size={12} /> Win Predictor
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex justify-between text-[10px] uppercase font-mono mb-2">
            <span className="text-neon-cyan font-bold">{battingTeamName}</span>
            <span className="text-white/40">{battingWinProb}%</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${battingWinProb}%` }}
              className="h-full bg-neon-cyan shadow-[0_0_15px_rgba(0,255,255,0.5)]"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] uppercase font-mono mb-2">
            <span className="text-neon-magenta font-bold">{bowlingTeamName}</span>
            <span className="text-white/40">{bowlingWinProb}%</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${bowlingWinProb}%` }}
              className="h-full bg-neon-magenta shadow-[0_0_15px_rgba(255,0,255,0.5)]"
            />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-center mt-4 text-white/40 italic uppercase tracking-widest">
        {battingWinProb > 50 ? `${battingTeamName} favorites` : `${bowlingTeamName} favorites`}
      </p>
    </motion.div>
  );
}

function PlayerStatsTable({ players, stats, title }: { players: Player[], stats: any, title: string }) {
  return (
    <div className="bg-brutal-black border border-neon-cyan/20 rounded-xl p-6 mt-6">
      <h3 className="font-serif text-2xl mb-4 italic text-neon-cyan">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 text-neon-cyan/60">
              <th className="p-2">Player</th>
              <th className="p-2">R</th>
              <th className="p-2">B</th>
              <th className="p-2">4s</th>
              <th className="p-2">6s</th>
              <th className="p-2">SR</th>
              <th className="p-2">W</th>
              <th className="p-2">O</th>
              <th className="p-2">Econ</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const s = stats[String(p.id)];
              if (!s) return null;
              const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0';
              return (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-2 font-bold">{p.name}</td>
                  <td className="p-2">{s.runs}</td>
                  <td className="p-2">{s.balls}</td>
                  <td className="p-2">{s.fours}</td>
                  <td className="p-2">{s.sixes}</td>
                  <td className="p-2">{sr}</td>
                  <td className="p-2">{s.wickets}</td>
                  <td className="p-2">{s.overs}</td>
                  <td className="p-2">{s.economy}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchStartSetupModal({ inningsNo, battingTeamName, bowlingTeamName, battingPlayers, bowlingPlayers, onComplete }: { inningsNo: number, battingTeamName: string, bowlingTeamName: string, battingPlayers: Player[], bowlingPlayers: Player[], onComplete: (batsman1: string, batsman2: string, bowler: string) => void }) {
  console.log('MatchStartSetupModal players:', { battingPlayers, bowlingPlayers });
  const [batsman1, setBatsman1] = useState<string | null>(null);
  const [batsman2, setBatsman2] = useState<string | null>(null);
  const [bowler, setBowler] = useState<string | null>(null);

  const isReady = batsman1 !== null && batsman2 !== null && bowler !== null;

  if (battingPlayers.length === 0 || bowlingPlayers.length === 0) {
    return (
      <div className="fixed inset-0 bg-brutal-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <div className="text-neon-cyan font-mono tracking-[0.3em] uppercase text-sm animate-pulse">Initializing Match Engine...</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-brutal-black border border-neon-cyan p-8 rounded-3xl w-full max-w-2xl shadow-[0_0_50px_rgba(0,255,255,0.2)]">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-neon-cyan text-brutal-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Innings {inningsNo}
            </span>
            <h2 className="font-serif text-3xl italic text-neon-cyan leading-tight">Match Setup</h2>
          </div>
          <p className="text-white/60 font-mono text-xs uppercase tracking-widest">
            Batting: <span className="text-neon-cyan font-bold">{battingTeamName}</span> | 
            Bowling: <span className="text-neon-cyan font-bold">{bowlingTeamName}</span>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wider">Batsman 1</h3>
            <div className="overflow-y-auto">
              {battingPlayers.map(p => (
                <button key={p.id} onClick={() => setBatsman1(p.id)} className={`w-full p-3 mb-2 text-left border rounded-lg transition-all ${batsman1 === p.id ? 'bg-neon-cyan text-brutal-black border-neon-cyan' : 'border-white/10 hover:border-white/30'}`}>{p.name}</button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wider">Batsman 2</h3>
            <div className="overflow-y-auto">
              {battingPlayers.map(p => (
                <button key={p.id} onClick={() => setBatsman2(p.id)} className={`w-full p-3 mb-2 text-left border rounded-lg transition-all ${batsman2 === p.id ? 'bg-neon-cyan text-brutal-black border-neon-cyan' : 'border-white/10 hover:border-white/30'}`}>{p.name}</button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wider">Bowler</h3>
            <div className="overflow-y-auto">
              {bowlingPlayers.map(p => (
                <button key={p.id} onClick={() => setBowler(p.id)} className={`w-full p-3 mb-2 text-left border rounded-lg transition-all ${bowler === p.id ? 'bg-neon-cyan text-brutal-black border-neon-cyan' : 'border-white/10 hover:border-white/30'}`}>{p.name}</button>
              ))}
            </div>
          </div>
        </div>
        <button 
          disabled={!isReady}
          onClick={() => onComplete(batsman1!, batsman2!, bowler!)}
          className="w-full mt-8 py-4 bg-neon-cyan text-brutal-black font-black rounded-xl disabled:opacity-50 hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-widest"
        >
          Start Innings
        </button>
      </div>
    </motion.div>
  );
}

function TossModal({ match, onComplete }: { match: Match, onComplete: (winnerId: string, decision: 'bat' | 'bowl') => void }) {
  const [callingTeamId, setCallingTeamId] = useState<string>(match.team_a_id);
  const [choice, setChoice] = useState<'heads' | 'tails' | null>(null);
  const [step, setStep] = useState<'select_team' | 'select_choice' | 'spin' | 'result'>('select_team');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const spinCoin = (selectedChoice: 'heads' | 'tails') => {
    setChoice(selectedChoice);
    setSpinning(true);
    setStep('spin');
    setTimeout(() => {
      const res = Math.random() > 0.5 ? 'heads' : 'tails';
      setResult(res);
      setSpinning(false);
      const won = res === selectedChoice;
      setWinnerId(won ? callingTeamId : (callingTeamId === match.team_a_id ? match.team_b_id : match.team_a_id));
      setStep('result');
    }, 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4"
    >
      <div className="max-w-md w-full text-center">
        {step === 'select_team' && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="space-y-8">
            <h2 className="font-serif text-5xl italic text-neon-cyan">The Toss</h2>
            <p className="text-white/60 uppercase tracking-[0.3em] text-[10px]">Select team to call</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setCallingTeamId(match.team_a_id); setStep('select_choice'); }}
                className={`py-4 rounded-2xl border-2 transition-all font-black uppercase tracking-widest ${callingTeamId === match.team_a_id ? 'border-neon-cyan bg-neon-cyan text-brutal-black' : 'border-white/10 hover:border-white/30'}`}
              >
                {match.team_a_name}
              </button>
              <button 
                onClick={() => { setCallingTeamId(match.team_b_id); setStep('select_choice'); }}
                className={`py-4 rounded-2xl border-2 transition-all font-black uppercase tracking-widest ${callingTeamId === match.team_b_id ? 'border-neon-cyan bg-neon-cyan text-brutal-black' : 'border-white/10 hover:border-white/30'}`}
              >
                {match.team_b_name}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'select_choice' && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="space-y-8">
            <h2 className="font-serif text-5xl italic text-neon-cyan">
              {callingTeamId === match.team_a_id ? match.team_a_name : match.team_b_name} calling
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => spinCoin('heads')}
                className={`py-4 rounded-2xl border-2 transition-all font-black uppercase tracking-widest ${choice === 'heads' ? 'border-neon-cyan bg-neon-cyan text-brutal-black' : 'border-white/10 hover:border-white/30'}`}
              >
                Heads
              </button>
              <button 
                onClick={() => spinCoin('tails')}
                className={`py-4 rounded-2xl border-2 transition-all font-black uppercase tracking-widest ${choice === 'tails' ? 'border-neon-cyan bg-neon-cyan text-brutal-black' : 'border-white/10 hover:border-white/30'}`}
              >
                Tails
              </button>
            </div>
            <button onClick={() => setStep('select_team')} className="text-white/40 hover:text-white">Back</button>
          </motion.div>
        )}

        {step === 'spin' && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="space-y-8">
            <h2 className="font-serif text-5xl italic text-neon-cyan">Spinning...</h2>
            <div className="relative h-48 flex items-center justify-center">
              <motion.div
                animate={{ rotateY: 3600, scale: [1, 1.2, 1] }}
                transition={{ duration: 2, ease: "easeInOut" }}
                className="w-32 h-32 rounded-full border-4 border-neon-cyan bg-brutal-black flex items-center justify-center shadow-[0_0_30px_rgba(0,255,255,0.4)]"
              >
                <span className="text-neon-cyan font-black text-4xl uppercase">?</span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {step === 'result' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-8">
            <div className="w-24 h-24 bg-neon-cyan rounded-full mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(0,255,255,0.5)]">
              <Trophy className="text-brutal-black" size={40} />
            </div>
            <h2 className="font-serif text-4xl italic text-white">
              Result: {result?.toUpperCase()}! <br/>
              {winnerId === match.team_a_id ? match.team_a_name : match.team_b_name} won the toss!
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => onComplete(winnerId!.toString(), 'bat')}
                className="py-4 border border-neon-cyan text-neon-cyan rounded-2xl font-black uppercase tracking-widest hover:bg-neon-cyan hover:text-brutal-black transition-all"
              >
                Bat First
              </button>
              <button 
                onClick={() => onComplete(winnerId!.toString(), 'bowl')}
                className="py-4 border border-neon-cyan text-neon-cyan rounded-2xl font-black uppercase tracking-widest hover:bg-neon-cyan hover:text-brutal-black transition-all"
              >
                Bowl First
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}


function Scorecard({ match, balls, currentBatsmanId, nonStrikerId, currentBowlerId, teamAPlayers, teamBPlayers }: { match: Match, balls: Ball[], currentBatsmanId: string | null, nonStrikerId: string | null, currentBowlerId: string | null, teamAPlayers: Player[], teamBPlayers: Player[] }) {
  const [innings, setInnings] = useState(match.current_innings);
  const inningsBalls = balls.filter(b => b.innings_no === innings);
  
  const isTeamABattingFirst = (match.toss_winner_id === match.team_a_id && match.toss_decision === 'bat') ||
                               (match.toss_winner_id === match.team_b_id && match.toss_decision === 'bowl');

  const teamABatsInInnings = innings === 1 ? isTeamABattingFirst : !isTeamABattingFirst;

  const battingTeamName = teamABatsInInnings ? match.team_a_name : match.team_b_name;
  const bowlingTeamName = teamABatsInInnings ? match.team_b_name : match.team_a_name;
  const battingPlayers = teamABatsInInnings ? teamAPlayers : teamBPlayers;
  const bowlingPlayers = teamABatsInInnings ? teamBPlayers : teamAPlayers;

  const totalRuns = inningsBalls.reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
  const totalWickets = inningsBalls.filter(b => b.wicket_type).length;
  const totalBalls = inningsBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'noball').length;
  const overs = Math.floor(totalBalls / 6);
  const ballsInOver = totalBalls % 6;

  const extras = inningsBalls.reduce((sum, b) => sum + Number(b.extra_runs || 0), 0);
  const extrasBreakdown = inningsBalls.reduce((acc, b) => {
    if (b.extra_type) acc[b.extra_type] = (acc[b.extra_type] || 0) + Number(b.extra_runs || 0);
    return acc;
  }, {} as Record<string, number>);

  const fallOfWickets = inningsBalls.filter(b => b.wicket_type).map((b, i) => ({
    wicket: i + 1,
    runs: inningsBalls.slice(0, inningsBalls.indexOf(b) + 1).reduce((sum, ball) => sum + Number(ball.runs || 0) + Number(ball.extra_runs || 0), 0),
    over: Math.floor(inningsBalls.slice(0, inningsBalls.indexOf(b) + 1).filter(ball => ball.extra_type !== 'wide' && ball.extra_type !== 'noball').length / 6),
    ball: inningsBalls.slice(0, inningsBalls.indexOf(b) + 1).filter(ball => ball.extra_type !== 'wide' && ball.extra_type !== 'noball').length % 6
  }));

  return (
    <div className="space-y-6 text-white">
      <div className="flex gap-4">
        <button onClick={() => setInnings(1)} className={`px-4 py-2 rounded-full ${innings === 1 ? 'bg-neon-cyan text-brutal-black' : 'bg-white/5'}`}>Innings 1</button>
        <button onClick={() => setInnings(2)} className={`px-4 py-2 rounded-full ${innings === 2 ? 'bg-neon-cyan text-brutal-black' : 'bg-white/5'}`}>Innings 2</button>
        {match.match_type === 'test' && (
          <>
            <button onClick={() => setInnings(3)} className={`px-4 py-2 rounded-full ${innings === 3 ? 'bg-neon-cyan text-brutal-black' : 'bg-white/5'}`}>Innings 3</button>
            <button onClick={() => setInnings(4)} className={`px-4 py-2 rounded-full ${innings === 4 ? 'bg-neon-cyan text-brutal-black' : 'bg-white/5'}`}>Innings 4</button>
          </>
        )}
      </div>
      <div className="bg-white/5 p-6 rounded-xl">
        <h2 className="text-2xl font-bold text-neon-cyan">{battingTeamName} Innings</h2>
        <div className="text-4xl font-black">{totalRuns}/{totalWickets} ({overs}.{ballsInOver} overs)</div>
      </div>
      
      <div className="bg-white/5 p-6 rounded-xl">
        <h3 className="text-lg font-bold mb-4">Batting</h3>
        <div className="grid grid-cols-6 text-[10px] uppercase font-mono opacity-50 mb-2">
          <div className="col-span-2">Batsman</div>
          <div>R</div><div>B</div><div>4s</div><div>6s</div><div>SR</div>
        </div>
        {battingPlayers?.map(p => {
          const playerBalls = inningsBalls.filter(b => b.batsman_id?.toString() === p.id?.toString());
          const runs = playerBalls.reduce((sum, b) => sum + Number(b.runs || 0), 0);
          const ballsFaced = playerBalls.filter(b => b.extra_type !== 'wide').length;
          const fours = playerBalls.filter(b => Number(b.runs) === 4).length;
          const sixes = playerBalls.filter(b => Number(b.runs) === 6).length;
          const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(1) : '0.0';
          const dismissal = playerBalls.find(b => b.wicket_type)?.wicket_type;
          
          if (ballsFaced === 0 && p.id?.toString() !== currentBatsmanId?.toString() && p.id?.toString() !== nonStrikerId?.toString()) return null;
          
          const isStriker = p.id?.toString() === currentBatsmanId?.toString();
          const isOut = !!dismissal;

          return (
            <div key={p.id} className="grid grid-cols-6 py-2 border-b border-white/5 items-center">
              <div className="col-span-2 font-bold">
                {p.name} {isStriker && '*'}
                {isOut && <span className="text-red-500 text-[10px] block font-normal">{dismissal}</span>}
              </div>
              <div className={runs >= 100 ? 'text-amber-400 font-bold' : (runs >= 50 ? 'text-yellow-500 font-bold' : '')}>{runs}</div>
              <div>{ballsFaced}</div>
              <div>{fours}</div>
              <div>{sixes}</div>
              <div>{strikeRate}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/5 p-6 rounded-xl">
        <h3 className="text-lg font-bold mb-4">Bowling</h3>
        <div className="grid grid-cols-6 text-[10px] uppercase font-mono opacity-50 mb-2">
          <div className="col-span-2">Bowler</div>
          <div>O</div><div>M</div><div>R</div><div>W</div><div>Econ</div>
        </div>
        {bowlingPlayers?.map(p => {
          const playerBalls = inningsBalls.filter(b => b.bowler_id?.toString() === p.id?.toString());
          const ballsBowled = playerBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'noball').length;
          const overs = Math.floor(ballsBowled / 6);
          const ballsInOver = ballsBowled % 6;
          const runsConceded = playerBalls.reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
          const wickets = playerBalls.filter(b => b.wicket_type).length;
          const maidens = 0; // Simplified
          const economy = (ballsBowled > 0) ? ((runsConceded / ballsBowled) * 6).toFixed(1) : '0.0';
          
          if (ballsBowled === 0 && p.id?.toString() !== currentBowlerId?.toString()) return null;
          return (
            <div key={p.id} className="grid grid-cols-6 py-2 border-b border-white/5 items-center">
              <div className="col-span-2 font-bold">{p.name} {p.id?.toString() === currentBowlerId?.toString() && '*'}</div>
              <div>{overs}.{ballsInOver}</div>
              <div>{maidens}</div>
              <div>{runsConceded}</div>
              <div className="text-red-500 font-bold">{wickets}</div>
              <div>{economy}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/5 p-6 rounded-xl">
        <h3 className="text-lg font-bold mb-4">Extras & FOW</h3>
        <div className="text-sm">Extras: {extras} ({Object.entries(extrasBreakdown).map(([k, v]) => `${k}:${v}`).join(', ')})</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {fallOfWickets.map(f => (
            <span key={f.wicket} className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-sm">
              {f.wicket}-{f.runs} ({f.over}.{f.ball})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            top: '100%', 
            left: `${Math.random() * 100}%`,
            scale: 0,
            opacity: 1
          }}
          animate={{ 
            top: `${Math.random() * 50}%`,
            scale: [0, 1.5, 0],
            opacity: [1, 1, 0],
            rotate: [0, 360]
          }}
          transition={{ 
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeOut"
          }}
          className={`absolute w-2 h-2 rounded-full ${
            ['bg-neon-cyan', 'bg-white', 'bg-yellow-400', 'bg-pink-500'][Math.floor(Math.random() * 4)]
          } shadow-[0_0_10px_currentColor]`}
        />
      ))}
    </div>
  );
}

function VirtualKeyboard({ onKeyPress, onBackspace, onClear, onClose }: { onKeyPress: (key: string) => void, onBackspace: () => void, onClear: () => void, onClose: () => void }) {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ' '],
  ];

  return (
    <motion.div 
      initial={{ y: 300 }}
      animate={{ y: 0 }}
      exit={{ y: 300 }}
      className="fixed bottom-0 left-0 right-0 bg-brutal-black border-t border-neon-cyan p-4 z-[100] shadow-[0_-10px_50px_rgba(0,255,255,0.2)]"
    >
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] uppercase font-mono text-neon-cyan tracking-widest">Neon Keypad</span>
          <button onClick={onClose} className="text-white/40 hover:text-white"><Undo2 size={16} /></button>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-1">
            {row.map(key => (
              <button
                key={key}
                onClick={() => onKeyPress(key)}
                className={`h-12 ${key === ' ' ? 'flex-[3]' : 'flex-1'} bg-white/5 border border-white/10 rounded-lg font-bold hover:bg-neon-cyan hover:text-brutal-black transition-all active:scale-95`}
              >
                {key === ' ' ? 'SPACE' : key}
              </button>
            ))}
          </div>
        ))}
        <div className="flex justify-center gap-1 mt-2">
          <button
            onClick={onClear}
            className="flex-1 h-12 bg-red-500/20 border border-red-500/30 rounded-lg font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all"
          >
            CLEAR
          </button>
          <button
            onClick={onBackspace}
            className="flex-1 h-12 bg-white/10 border border-white/20 rounded-lg font-bold hover:bg-white/20 transition-all"
          >
            BACKSPACE
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-12 bg-neon-cyan border border-neon-cyan rounded-lg font-black text-brutal-black hover:brightness-110 transition-all"
          >
            DONE
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function VictoryCelebration({ winnerName, resultMessage, onBack, onViewScorecard }: { winnerName: string, resultMessage?: string, onBack: () => void, onViewScorecard: () => void }) {
  useEffect(() => {
    const victorySound = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
    const crackersSound = new Audio('https://actions.google.com/sounds/v1/explosions/fireworks_explosion.ogg');
    
    victorySound.play().catch(e => console.error("Sound play failed", e));
    crackersSound.play().catch(e => console.error("Sound play failed", e));

    return () => {
      victorySound.pause();
      crackersSound.pause();
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-brutal-black/95 backdrop-blur-2xl flex flex-col items-center justify-center z-[70] p-4 text-center"
    >
      <Confetti />
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 12 }}
        className="relative mb-12"
      >
        <div className="absolute inset-0 bg-neon-cyan blur-[100px] opacity-20 animate-pulse" />
        <Trophy size={160} className="text-neon-cyan relative z-10 drop-shadow-[0_0_30px_rgba(0,255,255,0.8)]" />
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="space-y-4"
      >
        <p className="text-neon-cyan font-mono text-4xl uppercase tracking-[0.4em] font-bold">
          {winnerName}
        </p>
      </motion.div>

      <div className="flex gap-4 mt-16">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          onClick={onViewScorecard}
          className="px-8 py-4 bg-neon-cyan text-brutal-black rounded-full font-black uppercase tracking-widest hover:brightness-110 transition-all"
        >
          View Scorecard
        </motion.button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          onClick={onBack}
          className="px-8 py-4 border border-neon-cyan text-neon-cyan rounded-full font-black uppercase tracking-widest hover:bg-neon-cyan hover:text-brutal-black transition-all"
        >
          Return to Dashboard
        </motion.button>
      </div>
    </motion.div>
  );
}
