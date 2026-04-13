import { db } from '../db';
import { Ball, Match } from '../types';

export const addBall = async (matchId: string, currentInnings: number, totalBalls: number, batsmanId: string | null, bowlerId: string | null, ballData: Partial<Ball>, batsmanName?: string, bowlerName?: string) => {
  const nextBallNo = (totalBalls % 6) + 1;
  const nextOverNo = Math.floor(totalBalls / 6);
  try {
    await db.balls.add({
      match_id: matchId,
      innings_no: currentInnings,
      over_no: nextOverNo,
      ball_no: nextBallNo,
      runs: 0,
      extra_runs: 0,
      extra_type: null,
      wicket_type: null,
      batsman_id: batsmanId || 'unknown_batsman',
      bowler_id: bowlerId || 'unknown_bowler',
      batsman_name: batsmanName,
      bowler_name: bowlerName,
      timestamp: new Date().toISOString(),
      ...ballData
    } as any);
  } catch (err) {
    console.error('Failed to add ball:', err);
  }
};

export const undoLast = async (matchId: string, balls: Ball[]) => {
  try {
    const lastBall = balls[balls.length - 1];
    if (!lastBall) return;
    await db.balls.delete(lastBall.id);
  } catch (err) {
    console.error('Failed to undo ball:', err);
  }
};

export const declareResult = async (match: Match) => {
  try {
    const allBalls = await db.balls.where('match_id').equals(match.id).toArray();
    const innings1Runs = allBalls.filter(b => b.innings_no === 1).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
    const innings2Runs = allBalls.filter(b => b.innings_no === 2).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
    const innings3Runs = allBalls.filter(b => b.innings_no === 3).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);
    const innings4Runs = allBalls.filter(b => b.innings_no === 4).reduce((sum, b) => sum + Number(b.runs || 0) + Number(b.extra_runs || 0), 0);

    const isTeamABattingFirst = String(match.toss_winner_id) === String(match.team_a_id) ? match.toss_decision === 'bat' : match.toss_decision === 'bowl';

    let teamARuns = 0;
    let teamBRuns = 0;

    if (match.is_follow_on) {
      // Team A batted 1st, Team B batted 2nd and 3rd, Team A bats 4th
      if (isTeamABattingFirst) {
        teamARuns = innings1Runs + innings4Runs;
        teamBRuns = innings2Runs + innings3Runs;
      } else {
        // Team B batted 1st, Team A batted 2nd and 3rd, Team B bats 4th
        teamBRuns = innings1Runs + innings4Runs;
        teamARuns = innings2Runs + innings3Runs;
      }
    } else {
      teamARuns = isTeamABattingFirst ? (innings1Runs + innings3Runs) : (innings2Runs + innings4Runs);
      teamBRuns = isTeamABattingFirst ? (innings2Runs + innings4Runs) : (innings1Runs + innings3Runs);
    }

    let winnerId: string | null = null;
    let resultMessage = '';

    if (match.match_type === 'test') {
      const totalBalls = allBalls.length;
      const isDay5Ended = totalBalls >= 90 * 5 * 6;
      
      // Check if 4th innings finished
      const isFourthInningsFinished = match.current_innings === 4 && (
        allBalls.filter(b => b.innings_no === 4 && b.wicket_type).length >= match.wickets ||
        (match.is_follow_on 
          ? (isTeamABattingFirst ? teamARuns > teamBRuns : teamBRuns > teamARuns) // Team batting 4th chased target
          : (isTeamABattingFirst ? teamBRuns > teamARuns : teamARuns > teamBRuns) // Team batting 4th chased target
        )
      );

      if (isFourthInningsFinished) {
        if (teamARuns > teamBRuns) {
          winnerId = match.team_a_id;
          const margin = teamARuns - teamBRuns;
          // If Team A batted 4th (follow-on), they won by wickets. Otherwise by runs.
          const wonByRuns = isTeamABattingFirst !== match.is_follow_on;
          resultMessage = wonByRuns ? `${match.team_a_name} won by ${margin} runs` : `${match.team_a_name} won by ${match.wickets - allBalls.filter(b => b.innings_no === 4 && b.wicket_type).length} wickets`;
        } else if (teamBRuns > teamARuns) {
          winnerId = match.team_b_id;
          const margin = teamBRuns - teamARuns;
          // If Team B batted 4th (no follow-on), they won by wickets. Otherwise by runs.
          const wonByRuns = isTeamABattingFirst === match.is_follow_on;
          resultMessage = wonByRuns ? `${match.team_b_name} won by ${margin} runs` : `${match.team_b_name} won by ${match.wickets - allBalls.filter(b => b.innings_no === 4 && b.wicket_type).length} wickets`;
        } else {
          winnerId = null;
          resultMessage = 'Match Tied';
        }
      } else if (match.current_innings === 3) {
        // Check for innings win
        if (allBalls.filter(b => b.innings_no === 3 && b.wicket_type).length >= match.wickets || match.is_declared) {
          if (match.is_follow_on) {
            // Team B (batting 3rd) is all out. If they still trail Team A's 1st innings, Team A wins.
            if (teamARuns > teamBRuns) {
              winnerId = match.team_a_id;
              resultMessage = `${match.team_a_name} won by an innings and ${teamARuns - teamBRuns} runs`;
            }
          } else {
            // Team A (batting 3rd) is all out. If they still trail Team B's 1st innings, Team B wins.
            if (teamBRuns > teamARuns) {
              winnerId = match.team_b_id;
              resultMessage = `${match.team_b_name} won by an innings and ${teamBRuns - teamARuns} runs`;
            }
          }
        }
      }

      if (!winnerId && isDay5Ended) {
        winnerId = null;
        resultMessage = 'Match Drawn';
      }
    } else {
      // Limited overs logic
      if (teamARuns > teamBRuns) {
        winnerId = match.team_a_id;
        resultMessage = isTeamABattingFirst ? `${match.team_a_name} won by ${teamARuns - teamBRuns} runs` : `${match.team_a_name} won by ${match.wickets - allBalls.filter(b => b.innings_no === 2 && b.wicket_type).length} wickets`;
      } else if (teamBRuns > teamARuns) {
        winnerId = match.team_b_id;
        resultMessage = !isTeamABattingFirst ? `${match.team_b_name} won by ${teamBRuns - teamARuns} runs` : `${match.team_b_name} won by ${match.wickets - allBalls.filter(b => b.innings_no === 2 && b.wicket_type).length} wickets`;
      } else {
        winnerId = null;
        resultMessage = 'Match Tied';
      }
    }

    await db.matches.update(match.id, {
      status: 'finished',
      winner_id: winnerId as string,
      result_message: resultMessage
    });

    return { winnerId, resultMessage };
  } catch (err) {
    console.error('Failed to declare result:', err);
    return null;
  }
};

export const transitionInnings = async (match: Match, isDeclaration: boolean = false) => {
  try {
    if (match.match_type === 'test') {
      if (match.current_innings < 4) {
        // Check for innings win before transitioning to 4th innings
        if (match.current_innings === 3) {
          const result = await declareResult(match);
          if (result?.winnerId) return; // Match finished by innings win
        }

        await db.matches.update(match.id, {
          current_innings: match.current_innings + 1,
          is_declared: false, // Reset for new innings
          // Reset striker/bowler for new innings
          current_striker_id: null,
          non_striker_id: null,
          current_bowler_id: null
        });
        if (isDeclaration) {
          // We might want to mark the PREVIOUS innings as declared in a more permanent way, 
          // but for now, the transition logic handles it.
        }
      } else {
        // 4th innings ended
        await declareResult(match);
      }
    } else {
      // Limited overs
      if (match.current_innings === 1) {
        await db.matches.update(match.id, {
          current_innings: 2,
          current_striker_id: null,
          non_striker_id: null,
          current_bowler_id: null
        });
      } else {
        await declareResult(match);
      }
    }
  } catch (err) {
    console.error('Failed to transition innings:', err);
  }
};
