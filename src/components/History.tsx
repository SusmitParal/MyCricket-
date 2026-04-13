import React from 'react';
import type { Match } from '../types';

export default function History({ matches }: { matches: Match[] }) {
  const finishedMatches = matches.filter(m => m.status === 'finished');
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-neon-cyan">Match History</h2>
      <div className="space-y-4">
        {finishedMatches.length === 0 ? (
          <p className="text-white/50 italic">No finished matches yet.</p>
        ) : (
          finishedMatches.map(match => (
            <div key={match.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {match.team_a_icon && <span className="text-xl">{match.team_a_icon}</span>}
                  <p className="font-bold">{match.team_a_name} vs {match.team_b_name}</p>
                  {match.team_b_icon && <span className="text-xl">{match.team_b_icon}</span>}
                </div>
                <p className="text-xs opacity-50">{new Date(match.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-neon-cyan">
                  {match.balls?.filter(b => b.innings_no === 1).reduce((sum, b) => sum + b.runs + b.extra_runs, 0)} - {match.balls?.filter(b => b.innings_no === 2).reduce((sum, b) => sum + b.runs + b.extra_runs, 0)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
