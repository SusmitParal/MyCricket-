import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { transitionInnings } from '../services/scoringService';
import type { Match, Ball } from '../types';
import { Circle, TrendingUp, Plus, Undo2, Share2 } from 'lucide-react';

export default function LiveScoreboard({ match, addBall, undoLast, onWicket, onDeclare, onFollowOn, onShare, onBack, showVictory, setShowVictory, setShowGlassBreak }: { match: Match, addBall: (matchId: string, currentInnings: number, totalBalls: number, batsmanId: string | null, bowlerId: string | null, ballData: Partial<Ball>, batsmanName?: string, bowlerName?: string) => void, undoLast: (matchId: string, balls: Ball[]) => void, onWicket: () => void, onDeclare: () => void, onFollowOn?: () => void, onShare: () => void, onBack?: () => void, showVictory?: boolean, setShowVictory?: (v: boolean) => void, setShowGlassBreak?: (v: boolean) => void }) {
  const balls = useLiveQuery(() => db.balls.where('match_id').equals(match.id).toArray(), [match.id]) || [];
  const [pendingExtra, setPendingExtra] = useState<'wide' | 'noball' | 'bye' | 'legbye' | null>(null);
  
  const currentBatsmanId = match.current_striker_id;
  const nonStrikerId = match.non_striker_id;
  const currentBowlerId = match.current_bowler_id;

  const battingPlayers = match.current_innings % 2 !== 0 ? match.players?.team_a : match.players?.team_b;
  const bowlingPlayers = match.current_innings % 2 !== 0 ? match.players?.team_b : match.players?.team_a;

  const handleAddBall = (ballData: Partial<Ball>) => {
    const batsmanName = battingPlayers?.find(p => p.id === currentBatsmanId)?.name;
    const bowlerName = bowlingPlayers?.find(p => p.id === currentBowlerId)?.name;
    addBall(match.id, match.current_innings, stats.totalBalls, currentBatsmanId || null, currentBowlerId || null, ballData, batsmanName, bowlerName);
  };
  const handleUndo = () => {
    undoLast(match.id, balls);
  };
  
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
    
    // Test Cricket Specifics
    const inningsRuns = [
      balls.filter(b => b.innings_no === 1).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0),
      balls.filter(b => b.innings_no === 2).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0),
      balls.filter(b => b.innings_no === 3).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0),
      balls.filter(b => b.innings_no === 4).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0),
    ];

    const isTeamABattingFirst = (String(match.toss_winner_id) === String(match.team_a_id) && match.toss_decision === 'bat') ||
                               (String(match.toss_winner_id) === String(match.team_b_id) && match.toss_decision === 'bowl');
    
    let teamABatsInInnings = match.current_innings % 2 !== 0 ? isTeamABattingFirst : !isTeamABattingFirst;
    if (match.is_follow_on && (match.current_innings === 3 || match.current_innings === 4)) {
      teamABatsInInnings = !teamABatsInInnings;
    }
    const battingTeamName = teamABatsInInnings ? match.team_a_name : match.team_b_name;

    let lead = 0;
    let trail = 0;
    let target = 0;
    let followOnPossible = false;
    let matchStatusText = '';

    if (match.match_type === 'test') {
      if (match.current_innings === 1) {
        matchStatusText = `${battingTeamName} batting 1st`;
      } else if (match.current_innings === 2) {
        trail = Math.max(0, inningsRuns[0] - totalRuns);
        lead = Math.max(0, totalRuns - inningsRuns[0]);
        matchStatusText = trail > 0 ? `${battingTeamName} trail by ${trail} runs` : `${battingTeamName} lead by ${lead} runs`;
        
        if (totalWickets >= match.wickets || match.is_declared) {
           if (inningsRuns[0] - inningsRuns[1] >= 200) {
             followOnPossible = true;
           }
        }
      } else if (match.current_innings === 3) {
        if (match.is_follow_on) {
          const teamBTotal = inningsRuns[1] + totalRuns;
          if (teamBTotal > inningsRuns[0]) {
            lead = teamBTotal - inningsRuns[0];
            matchStatusText = `${battingTeamName} lead by ${lead} runs`;
          } else {
            trail = inningsRuns[0] - teamBTotal;
            matchStatusText = `${battingTeamName} trail by ${trail} runs (Follow-on)`;
          }
        } else {
          const teamATotal = inningsRuns[0] + totalRuns;
          if (teamATotal > inningsRuns[1]) {
            lead = teamATotal - inningsRuns[1];
            matchStatusText = `${battingTeamName} lead by ${lead} runs`;
          } else {
            trail = inningsRuns[1] - teamATotal;
            matchStatusText = `${battingTeamName} trail by ${trail} runs`;
          }
        }
      } else if (match.current_innings === 4) {
        let targetRuns = 0;
        if (match.is_follow_on) {
          targetRuns = (inningsRuns[1] + inningsRuns[2]) - inningsRuns[0] + 1;
        } else {
          targetRuns = (inningsRuns[0] + inningsRuns[2]) - inningsRuns[1] + 1;
        }
        target = targetRuns;
        trail = Math.max(0, targetRuns - totalRuns);
        matchStatusText = totalRuns >= targetRuns ? `${battingTeamName} won` : `${battingTeamName} need ${trail} runs to win`;
      }
    } else {
      if (match.current_innings === 1) {
        matchStatusText = `1st Innings`;
      } else if (match.current_innings === 2) {
        target = inningsRuns[0] + 1;
        trail = Math.max(0, target - totalRuns);
        matchStatusText = `Need ${trail} runs from ${Math.max(0, match.total_overs * 6 - totalBalls)} balls`;
      }
    }

    const playerStats = calculatePlayerStats(balls, [...(battingPlayers || []), ...(bowlingPlayers || [])]);

    return { totalRuns, totalWickets, overs, remainingBalls, runRate, extras, target, lead, trail, followOnPossible, totalBalls, playerStats, inningsRuns, matchStatusText };
  }, [balls, match, battingPlayers, bowlingPlayers]);

  const striker = battingPlayers?.find(p => p.id === currentBatsmanId);
  const nonStriker = battingPlayers?.find(p => p.id === nonStrikerId);
  const bowler = bowlingPlayers?.find(p => p.id === currentBowlerId);

  const WinPredictor = () => {
    const runsRequired = stats.target - stats.totalRuns;
    const ballsRemaining = (match.total_overs * 6) - stats.totalBalls;
    
    let probability = 50;
    if (ballsRemaining > 0 && stats.target > 0) {
      const requiredRunRate = (runsRequired / (ballsRemaining / 6));
      const currentRunRate = parseFloat(stats.runRate);
      
      if (requiredRunRate < currentRunRate) {
        probability = 50 + (currentRunRate - requiredRunRate) * 5;
      } else {
        probability = 50 - (requiredRunRate - currentRunRate) * 5;
      }
    }
    
    probability = Math.min(Math.max(probability, 0), 100);
    
    return (
      <div className="bg-white/5 border border-neon-cyan/30 p-4 rounded-xl">
        <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mb-2">Win Predictor</div>
        <div className="text-2xl font-black text-white">{probability.toFixed(0)}%</div>
      </div>
    );
  };

  const isMatchOver = useMemo(() => {
    if (match.match_type === 'test') {
      // Day 5 ended (90 overs per day * 5 days = 450 overs)
      if (stats.totalBalls >= 450 * 6) return true;
      
      // Only end match in 4th innings
      if (match.current_innings === 4) {
        return stats.totalWickets >= match.wickets || stats.totalRuns >= stats.target || match.is_declared;
      }
      
      return false;
    } else {
      return match.current_innings === 2 && 
             (stats.totalRuns >= stats.target || stats.totalWickets >= match.wickets || stats.totalBalls >= match.total_overs * 6);
    }
  }, [match, stats, balls]);

  const testMatchInfo = useMemo(() => {
    if (match.match_type !== 'test') return null;
    const totalMatchBalls = balls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'noball').length;
    const day = Math.floor(totalMatchBalls / (90 * 6)) + 1;
    const ballsInDay = totalMatchBalls % (90 * 6);
    let session = 'Morning';
    if (ballsInDay >= 30 * 6 && ballsInDay < 60 * 6) session = 'Afternoon';
    else if (ballsInDay >= 60 * 6) session = 'Evening';
    return { day, session };
  }, [match.match_type, balls]);

  React.useEffect(() => {
    if (isMatchOver && !showVictory && setShowVictory && match.status !== 'finished') {
      onDeclare();
      setShowVictory(true);
    }
  }, [isMatchOver, showVictory, setShowVictory, onDeclare, match.status]);

  return (
    <div className="min-h-screen bg-brutal-black text-white p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-neon-cyan">
              <Undo2 size={24} />
            </button>
          )}
          <h1 className="font-serif text-4xl font-bold text-neon-cyan">Live Scoreboard</h1>
        </div>
        <div className="flex items-center gap-4">
          {match.match_type === 'test' && !match.is_declared && (
            <button 
              onClick={async () => {
                if (match.current_innings < 4) {
                  await transitionInnings(match, true);
                } else {
                  onDeclare();
                }
              }}
              className="text-[10px] uppercase font-black tracking-widest text-red-500 border border-red-500/30 px-4 py-2 rounded-full hover:bg-red-500 hover:text-white transition-all"
            >
              Declare Innings
            </button>
          )}
          <button 
            onClick={onShare}
            className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-neon-cyan border border-neon-cyan/30 px-4 py-2 rounded-full hover:bg-neon-cyan hover:text-brutal-black transition-all"
          >
            <Share2 size={12} /> Share Live URL
          </button>
        </div>
      </div>
      <div className="hardware-widget p-8 mb-8 relative overflow-hidden">
          <div className="flex justify-between items-start z-10 relative">
            <div>
              <div className="flex items-center gap-3">
                {match.team_a_icon ? (
                  <img src={match.team_a_icon} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/20" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/20 flex items-center justify-center text-xs font-bold text-white/20">A</div>
                )}
                <h3 className="font-serif italic text-xl text-neon-cyan/80">{match.team_a_name} vs {match.team_b_name}</h3>
                {match.team_b_icon ? (
                  <img src={match.team_b_icon} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/20" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/20 flex items-center justify-center text-xs font-bold text-white/20">B</div>
                )}
              </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
                {match.match_type === 'test' ? `Innings ${match.current_innings} • Day ${testMatchInfo?.day} • ${testMatchInfo?.session}` : 'Live Match'}
              </span>
              {match.is_follow_on && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded font-black uppercase">Follow On</span>}
            </div>
            <div className="flex items-baseline gap-4 mt-2">
              <span className="text-8xl font-black tracking-tighter text-white">{stats.totalRuns}</span>
              <span className="text-5xl font-light text-white/40">/ {stats.totalWickets}</span>
            </div>
            
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <WinPredictor />
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10">
                  <span className="font-bold truncate mr-2 text-neon-cyan">{striker?.name || 'Striker'} *</span>
                  <span className="text-neon-cyan font-mono">
                    {stats.playerStats[String(currentBatsmanId)]?.runs || 0} ({stats.playerStats[String(currentBatsmanId)]?.balls || 0})
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10 opacity-60">
                  <span className="font-bold truncate mr-2">{nonStriker?.name || 'Non-Striker'}</span>
                  <span className="font-mono">
                    {stats.playerStats[String(nonStrikerId)]?.runs || 0} ({stats.playerStats[String(nonStrikerId)]?.balls || 0})
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10">
                  <span className="font-bold truncate mr-2">{bowler?.name || 'Bowler'}</span>
                  <div className="text-right">
                    <div className="text-neon-cyan font-mono leading-none">
                      {stats.playerStats[String(currentBowlerId)]?.wickets || 0} - {stats.playerStats[String(currentBowlerId)]?.runsConceded || 0}
                    </div>
                    <div className="text-[10px] font-mono text-white/40 mt-1">
                      {Math.floor((stats.playerStats[String(currentBowlerId)]?.ballsBowled || 0) / 6)}.{ (stats.playerStats[String(currentBowlerId)]?.ballsBowled || 0) % 6 } ov
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mb-1">Overs</div>
            <div className="text-4xl font-mono font-bold">{stats.overs}.{stats.remainingBalls}</div>
            <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mt-4 mb-1">Run Rate</div>
            <div className="text-2xl font-mono text-neon-cyan">{stats.runRate}</div>
          </div>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="text-neon-cyan font-mono bg-neon-cyan/10 p-2 rounded border border-neon-cyan/20 text-xs uppercase tracking-widest">
            {stats.matchStatusText}
          </div>
          {stats.followOnPossible && (
            <button 
              onClick={onFollowOn}
              className="bg-red-600 text-white px-4 py-2 rounded font-black uppercase text-xs hover:bg-red-700 transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)]"
            >
              Enforce Follow-On
            </button>
          )}
        </div>

        {match.match_type === 'test' && (
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-4 gap-2 text-[10px] font-mono text-white/40">
            {stats.inningsRuns.map((runs, i) => (
              <div key={i} className={match.current_innings === i + 1 ? 'text-neon-cyan font-bold' : ''}>
                Inn {i + 1}: {runs}
              </div>
            ))}
          </div>
        )}

        {/* Ball-by-ball runs */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-[10px] uppercase font-mono text-neon-cyan/60 tracking-widest mb-2">Recent Balls</div>
          <div className="flex flex-wrap gap-2">
            {balls
              .filter(b => b.innings_no === match.current_innings)
              .slice(-12)
              .map((b, i) => (
                <div key={i} className="w-8 h-8 rounded-full border border-neon-cyan/50 flex items-center justify-center text-neon-cyan font-mono text-xs">
                  {Number(b.runs || 0) + Number(b.extra_runs || 0)}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Scoring Controls */}
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
                    onWicket(); // Trigger batsman selection
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
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={onWicket}
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
        </div>
      </div>
    </div>
  );
}

function calculatePlayerStats(balls: Ball[], players: any[]) {
  const stats: Record<string, any> = {};
  players.forEach(p => {
    stats[String(p.id)] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
  });

  balls.forEach(b => {
    const bId = b.batsman_id ? String(b.batsman_id) : null;
    const bowId = b.bowler_id ? String(b.bowler_id) : null;
    if (bId && stats[bId]) {
      stats[bId].runs += Number(b.runs || 0);
      if (b.extra_type !== 'wide') stats[bId].balls += 1;
    }
    if (bowId && stats[bowId]) {
      stats[bowId].runsConceded += (Number(b.runs || 0) + Number(b.extra_runs || 0));
      if (b.extra_type !== 'wide' && b.extra_type !== 'noball') stats[bowId].ballsBowled += 1;
      if (b.wicket_type && b.wicket_type !== 'Run Out' && b.wicket_type !== 'retired_hurt') stats[bowId].wickets += 1;
    }
  });

  return stats;
}
