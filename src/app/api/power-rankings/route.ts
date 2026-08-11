import { NextResponse } from 'next/server';
import { getCurrentLeagueId } from '@/config/league';
import { getAllLinkedLeagueIds } from '@/lib/api';
import { calculatePowerRankings } from '@/lib/powerRankings';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedSeason = searchParams.get('season');

  try {
    const currentLeagueId = await getCurrentLeagueId();
    let targetLeagueId = currentLeagueId;

    if (requestedSeason) {
      const allLeagues = await getAllLinkedLeagueIds(currentLeagueId);
      targetLeagueId = allLeagues.find(id => id.includes(requestedSeason)) || currentLeagueId;
    }

    const rankings = await calculatePowerRankings(targetLeagueId);
    return NextResponse.json({ season: requestedSeason || 'current', rankings });
  } catch (err) {
    console.error('[power-rankings-api]', err);
    return NextResponse.json({ error: 'Failed to fetch power rankings' }, { status: 500 });
  }
}