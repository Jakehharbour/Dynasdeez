'use client';

import { useState, useMemo } from 'react';
import { calculateSimulatedStandings, TeamStanding, MachineMatchup } from '@/lib/playoffMachine';

interface PlayoffMachineProps {
  initialTeams: TeamStanding[];
  futureMatchups: MachineMatchup[];
  playoffSpotCount?: number;
}

export default function PlayoffMachine({
  initialTeams = [],
  futureMatchups = [],
  playoffSpotCount = 6,
}: PlayoffMachineProps) {
  const [userSimulations, setUserSimulations] = useState<Record<number, number>>({});

  const activeMatchups = useMemo(() => {
    return futureMatchups.map((m) => ({
      ...m,
      simulatedWinnerId: userSimulations[m.matchupId],
    }));
  }, [futureMatchups, userSimulations]);

  const simulatedStandings = useMemo(() => {
    return calculateSimulatedStandings(initialTeams, activeMatchups);
  }, [initialTeams, activeMatchups]);

  const handleSelectWinner = (matchupId: number, winnerRosterId: number) => {
    setUserSimulations((prev) => {
      const current = prev[matchupId];
      if (current === winnerRosterId) {
        const copy = { ...prev };
        delete copy[matchupId];
        return copy;
      }
      return { ...prev, [matchupId]: winnerRosterId };
    });
  };

  const handleReset = () => setUserSimulations({});

  const matchupsByWeek = useMemo(() => {
    const grouped: Record<number, MachineMatchup[]> = {};
    activeMatchups.forEach((m) => {
      grouped[m.week] ??= [];
      grouped[m.week].push(m);
    });
    return grouped;
  }, [activeMatchups]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Playoff Machine</h1>
          <p className="text-gray-400">Pick future matchup winners to simulate playoff seeding.</p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
        >
          Reset All Picks
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-gray-900 p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl font-bold mb-4">Projected Standings</h2>
          <div className="space-y-2">
            {simulatedStandings.map((team) => {
              const isPlayoffBound = (team.seed ?? 99) <= playoffSpotCount;
              return (
                <div
                  key={team.rosterId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isPlayoffBound
                      ? 'bg-green-950/30 border-green-800/50'
                      : 'bg-gray-800/40 border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                        isPlayoffBound ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {team.seed}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">{team.ownerName}</p>
                      <p className="text-xs text-gray-400">{team.pointsFor.toFixed(1)} PF</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm">
                      {team.wins}-{team.losses}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {Object.entries(matchupsByWeek).map(([week, weekMatchups]) => (
            <div key={week} className="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <h3 className="text-lg font-bold mb-4">Week {week}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {weekMatchups.map((m) => {
                  const t1Name = initialTeams.find((t) => t.rosterId === m.team1.rosterId)?.ownerName || 'Team 1';
                  const t2Name = initialTeams.find((t) => t.rosterId === m.team2.rosterId)?.ownerName || 'Team 2';

                  const isT1Picked = m.simulatedWinnerId === m.team1.rosterId;
                  const isT2Picked = m.simulatedWinnerId === m.team2.rosterId;

                  return (
                    <div key={m.matchupId} className="bg-gray-800/60 p-3 rounded-lg space-y-2 border border-gray-700/50">
                      <button
                        onClick={() => handleSelectWinner(m.matchupId, m.team1.rosterId)}
                        className={`w-full flex justify-between items-center p-2 rounded text-sm font-medium transition ${
                          isT1Picked
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-gray-700/50 hover:bg-gray-700 text-gray-200'
                        }`}
                      >
                        <span>{t1Name}</span>
                        {isT1Picked && <span>✓ WIN</span>}
                      </button>

                      <button
                        onClick={() => handleSelectWinner(m.matchupId, m.team2.rosterId)}
                        className={`w-full flex justify-between items-center p-2 rounded text-sm font-medium transition ${
                          isT2Picked
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-gray-700/50 hover:bg-gray-700 text-gray-200'
                        }`}
                      >
                        <span>{t2Name}</span>
                        {isT2Picked && <span>✓ WIN</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}