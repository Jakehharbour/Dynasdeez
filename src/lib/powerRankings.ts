import { getLeagueRosters, getLeagueUsers } from '@/lib/api';

export interface PowerRankingEntry {
  rank: number;
  userId: string;
  teamName: string;
  avatar: string;
  wins: number;
  losses: number;
  pointsFor: number;
  powerScore: number;
  allPlayWins: number;
  allPlayLosses: number;
}

export async function calculatePowerRankings(leagueId: string, totalWeeks = 14): Promise<PowerRankingEntry[]> {
  const [rosters, users] = await Promise.all([
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
  ]);

  const userMap = new Map(users.map(u => [u.user_id, u]));
  
  const teamStats = new Map<number, {
    rosterId: number;
    userId: string;
    teamName: string;
    avatar: string;
    wins: number;
    losses: number;
    pointsFor: number;
    allPlayWins: number;
    allPlayLosses: number;
  }>();

  for (const r of rosters) {
    const u = userMap.get(r.owner_id);
    teamStats.set(r.roster_id, {
      rosterId: r.roster_id,
      userId: r.owner_id,
      teamName: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`,
      avatar: u?.avatar || '',
      wins: r.settings?.wins || 0,
      losses: r.settings?.losses || 0,
      pointsFor: (r.settings?.fpts || 0) + (r.settings?.fpts_decimal || 0) / 100,
      allPlayWins: 0,
      allPlayLosses: 0,
    });
  }

  // Calculate All-Play record (compare every team against every other team each week)
  for (let week = 1; week <= totalWeeks; week++) {
    try {
      const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
      if (!res.ok) continue;
      const matchups: { roster_id: number; points: number }[] = await res.json();
      
      if (!matchups || matchups.length === 0 || matchups.every(m => m.points === 0)) continue;

      for (const m1 of matchups) {
        const team = teamStats.get(m1.roster_id);
        if (!team) continue;

        for (const m2 of matchups) {
          if (m1.roster_id === m2.roster_id) continue;
          if (m1.points > m2.points) team.allPlayWins++;
          else if (m1.points < m2.points) team.allPlayLosses++;
        }
      }
    } catch {
      break;
    }
  }

  // Score Formula: 40% Record, 40% All-Play Record, 20% Total Points
  const teams = Array.from(teamStats.values());
  const maxPF = Math.max(...teams.map(t => t.pointsFor)) || 1;

  const ranked = teams.map(t => {
    const winPct = (t.wins + t.losses) > 0 ? t.wins / (t.wins + t.losses) : 0;
    const allPlayPct = (t.allPlayWins + t.allPlayLosses) > 0 ? t.allPlayWins / (t.allPlayWins + t.allPlayLosses) : 0;
    const pfPct = t.pointsFor / maxPF;

    const powerScore = Math.round((winPct * 40 + allPlayPct * 40 + pfPct * 20) * 10) / 10;

    return { ...t, powerScore };
  });

  // Sort teams from highest Power Score to lowest
  ranked.sort((a, b) => b.powerScore - a.powerScore);

  return ranked.map((t, index) => ({
    rank: index + 1,
    ...t,
  }));
}