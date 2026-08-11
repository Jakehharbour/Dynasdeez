import { NextResponse } from 'next/server';
import { getCurrentLeagueId } from '@/config/league';
import { getAllLinkedLeagueIds } from '@/lib/api';
import { calculatePowerRankings } from '@/lib/powerRankings';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedSeason = searchParams.get('season') || '2026';

  try {
    const currentLeagueId = await getCurrentLeagueId();
    const allLeagueIds = await getAllLinkedLeagueIds(currentLeagueId);
    
    let targetLeagueId = currentLeagueId;

    // Check each linked league ID against Sleeper's API to match the exact season year
    for (const id of allLeagueIds) {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/league/${id}`);
        if (!res.ok) continue;
        const leagueData = await res.json();
        if (leagueData.season === requestedSeason) {
          targetLeagueId = id;
          break;
        }
      } catch {
        continue;
      }
    }

    const rankings = await calculatePowerRankings(targetLeagueId);
    return NextResponse.json({ season: requestedSeason, rankings });
  } catch (err) {
    console.error('[power-rankings-api]', err);
    return NextResponse.json({ error: 'Failed to fetch power rankings' }, { status: 500 });
  }
}