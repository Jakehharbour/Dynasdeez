import PlayoffMachine from '@/components/ui/PlayoffMachine';
import { getLeagueRosters, getLeagueUsers, getLeagueMatchups, getLeagueInfo } from '@/lib/api';
import { INITIAL_LEAGUE_ID, getCurrentLeagueId } from '@/config/league';

export default async function PlayoffMachinePage() {
  const leagueId = INITIAL_LEAGUE_ID ?? (await getCurrentLeagueId());
  
  const [leagueInfo, users, rosters] = await Promise.all([
    getLeagueInfo(leagueId),
    getLeagueUsers(leagueId),
    getLeagueRosters(leagueId),
  ]);

  const userMap = new Map(users.map((u: any) => [u.user_id, u]));

  const initialTeams = rosters.map((r: any) => {
    const user = userMap.get(r.owner_id) as any;
    const wins = r.settings?.wins ?? 0;
    const losses = r.settings?.losses ?? 0;
    const ties = r.settings?.ties ?? 0;
    const pointsFor = (r.settings?.fpts ?? 0) + (r.settings?.fpts_decimal ?? 0) / 100;

    return {
      rosterId: r.roster_id,
      ownerName: user?.display_name || user?.username || `Team ${r.roster_id}`,
      avatar: user?.avatar || '',
      wins,
      losses,
      ties,
      pointsFor,
      winPercentage: wins + losses > 0 ? wins / (wins + losses) : 0,
    };
  });

  const playoffWeekStart = leagueInfo?.settings?.playoff_week_start || 15;
  const currentWeek = leagueInfo?.settings?.leg || 1; 

  const remainingWeeks: number[] = [];
  for (let w = currentWeek; w < playoffWeekStart; w++) {
    remainingWeeks.push(w);
  }

  const weeklyMatchups = await Promise.all(
    remainingWeeks.map((week) => getLeagueMatchups(leagueId, week))
  );

  const futureMatchups: any[] = [];
  
  weeklyMatchups.forEach((weekData, index) => {
    const weekNum = remainingWeeks[index];
    const grouped = new Map<number, any[]>();

    for (const m of weekData || []) {
      if (!m.matchup_id) continue;
      const arr = grouped.get(m.matchup_id) || [];
      arr.push(m);
      grouped.set(m.matchup_id, arr);
    }

    let matchupCounter = 1;
    for (const pair of grouped.values()) {
      if (pair.length !== 2) continue;
      futureMatchups.push({
        matchupId: Number(`${weekNum}${matchupCounter}`),
        week: weekNum,
        isCompleted: false,
        team1: { rosterId: pair[0].roster_id, score: 0 },
        team2: { rosterId: pair[1].roster_id, score: 0 },
      });
      matchupCounter++;
    }
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 bg-background text-foreground min-h-screen">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Playoff Machine</h1>
        <p className="text-muted-foreground">Simulate remaining matchups to see playoff seeding scenarios</p>
      </header>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <PlayoffMachine 
          initialTeams={initialTeams} 
          futureMatchups={futureMatchups} 
          playoffSpotCount={leagueInfo?.settings?.playoff_teams || 6} 
        />
      </div>
    </div>
  );
}