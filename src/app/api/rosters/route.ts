import { NextResponse } from 'next/server';
import { 
  getLeagueRosters, 
  getLeagueUsers, 
  getNFLState, 
  getAllLeagueSeasons, 
  getLeagueInfo,
  getAllLinkedLeagueIds 
} from '@/lib/api';
import { getCurrentLeagueId, INITIAL_LEAGUE_ID } from '@/config/league';
import {
  getPlayersDirectory,
  getSeasonStats,
  resolveStatsSeason,
  buildPlayerCard,
  type PlayerCard,
} from '@/lib/playerStats';

export const dynamic = 'force-dynamic';

export interface RosterTeam {
  rosterId:    number;
  userId:      string;
  teamName:    string;
  managerName: string;
  avatar:      string;
  record:      { wins: number; losses: number; ties: number };
  starters:    PlayerCard[];
  bench:       PlayerCard[];
}

export interface RostersResponse {
  statsSeason: string;
  seasons: string[];
  teams: RosterTeam[];
}

export async function GET(request: Request) {
  if (!INITIAL_LEAGUE_ID || INITIAL_LEAGUE_ID === 'YOUR_LEAGUE_ID') {
    return NextResponse.json({ error: 'No league configured' }, { status: 400 });
  }

  const requested = new URL(request.url).searchParams.get('season');

  try {
    const currentLeagueId = await getCurrentLeagueId();
    const [nflState, seasons] = await Promise.all([
      getNFLState(),
      getAllLeagueSeasons(currentLeagueId),
    ]);

    const defaultSeason = await resolveStatsSeason(nflState?.season ?? String(new Date().getFullYear()));
    const statsSeason = requested && seasons.includes(requested) ? requested : defaultSeason;

    // 1. Traverse linked leagues to find the specific leagueId for statsSeason
    let activeLeagueId = currentLeagueId;
    const linkedIds = await getAllLinkedLeagueIds(currentLeagueId);
    
    for (const id of linkedIds) {
      try {
        const info = await getLeagueInfo(id);
        if (info && String(info.season) === String(statsSeason)) {
          activeLeagueId = id;
          break;
        }
      } catch (e) {
        console.warn(`Failed to inspect league ${id}`, e);
      }
    }

    // 2. Fetch rosters and users using the season-specific activeLeagueId
    const [rosters, users, players, stats] = await Promise.all([
      getLeagueRosters(activeLeagueId),
      getLeagueUsers(activeLeagueId),
      getPlayersDirectory(),
      getSeasonStats(statsSeason),
    ]);

    const userById = new Map<string, any>(users.map((u: any) => [u.user_id, u]));

    const teams: RosterTeam[] = rosters.map((r: any) => {
      const u = userById.get(r.owner_id);
      const starterIds = (r.starters ?? []).filter((id: string) => id && id !== '0');
      const starterSet = new Set<string>(starterIds);
      const allIds = (r.players ?? []).filter(Boolean);

      const toCard = (id: string) => buildPlayerCard(id, players, stats);

      const bench = allIds
        .filter((id: string) => !starterSet.has(id))
        .map(toCard)
        .sort((a: PlayerCard, b: PlayerCard) => (b.points ?? -1) - (a.points ?? -1));

      return {
        rosterId: r.roster_id,
        userId: r.owner_id,
        teamName: u?.metadata?.team_name || u?.display_name || `Roster ${r.roster_id}`,
        managerName: u?.display_name ?? '',
        avatar: u?.avatar ?? '',
        record: {
          wins:   r.settings?.wins   ?? 0,
          losses: r.settings?.losses ?? 0,
          ties:   r.settings?.ties   ?? 0,
        },
        starters: starterIds.map(toCard),
        bench,
      };
    });

    return NextResponse.json({
      statsSeason,
      seasons: [...seasons].sort((a, b) => Number(b) - Number(a)),
      teams,
    } satisfies RostersResponse);
  } catch (err) {
    console.error('[api/rosters]', err);
    return NextResponse.json({ error: 'Failed to load rosters' }, { status: 500 });
  }
}