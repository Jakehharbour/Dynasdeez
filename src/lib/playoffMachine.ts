export interface TeamStanding {
  rosterId: number;
  ownerName: string;
  avatar: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  winPercentage: number;
  seed?: number;
}

export interface MachineMatchup {
  matchupId: number;
  week: number;
  isCompleted: boolean;
  team1: { rosterId: number; score: number };
  team2: { rosterId: number; score: number };
  simulatedWinnerId?: number;
}

export function calculateSimulatedStandings(
  initialTeams: TeamStanding[],
  matchups: MachineMatchup[]
): TeamStanding[] {
  const standingsMap = new Map<number, TeamStanding>();
  initialTeams.forEach((team) => {
    standingsMap.set(team.rosterId, { ...team });
  });

  matchups.forEach((m) => {
    if (!m.isCompleted && m.simulatedWinnerId) {
      const t1 = standingsMap.get(m.team1.rosterId);
      const t2 = standingsMap.get(m.team2.rosterId);

      if (t1 && t2) {
        if (m.simulatedWinnerId === t1.rosterId) {
          t1.wins += 1;
          t2.losses += 1;
        } else if (m.simulatedWinnerId === t2.rosterId) {
          t2.wins += 1;
          t1.losses += 1;
        }
      }
    }
  });

  const standings = Array.from(standingsMap.values()).map((team) => {
    const totalGames = team.wins + team.losses + team.ties;
    const winPercentage = totalGames > 0 ? (team.wins + team.ties * 0.5) / totalGames : 0;
    return { ...team, winPercentage };
  });

  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
    return b.pointsFor - a.pointsFor;
  });

  return standings.map((team, index) => ({
    ...team,
    seed: index + 1,
  }));
}