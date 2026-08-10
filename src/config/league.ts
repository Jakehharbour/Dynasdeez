import { getAllLinkedLeagueIds, getLeagueInfo } from '@/lib/api';

// The base league ID from environment variables, falling back to your active Sleeper League ID
export const INITIAL_LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || '1312511056450424832';

// Cache for linked league IDs
let linkedLeagueIdsCache: string[] | null = null;

/**
 * Traverses forward using Sleeper's renewal_id to find the absolute newest league ID
 */
async function getLatestLeagueId(startId: string): Promise<string> {
  let currentId = startId;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  while (attempts < maxAttempts) {
    try {
      const info = await getLeagueInfo(currentId);
      // If there is a newer renewed league, move forward
      if (info && info.renewal_id && info.status !== 'drafting' && info.renewal_id !== '0') {
        currentId = info.renewal_id;
        attempts++;
      } else if (info && info.renewal_id) {
        // Includes 'drafting' or active renewed seasons
        currentId = info.renewal_id;
        break;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return currentId;
}

/**
 * Gets all linked league IDs, sorted with the most recent season first
 */
export async function getLinkedLeagueIds(): Promise<string[]> {
  if (linkedLeagueIdsCache) {
    return linkedLeagueIdsCache;
  }

  if (!INITIAL_LEAGUE_ID || INITIAL_LEAGUE_ID === 'YOUR_LEAGUE_ID') {
    return [];
  }

  try {
    // 1. Find the true newest league ID first
    const newestId = await getLatestLeagueId(INITIAL_LEAGUE_ID);

    // 2. Traversal backward from the newest ID to get all historical seasons in order
    linkedLeagueIdsCache = await getAllLinkedLeagueIds(newestId);
    return linkedLeagueIdsCache;
  } catch (error) {
    console.error('Failed to get linked league IDs:', error);
    return [INITIAL_LEAGUE_ID];
  }
}

/**
 * Gets the most recent league ID (e.g., 2026)
 */
export async function getCurrentLeagueId(): Promise<string> {
  const ids = await getLinkedLeagueIds();
  return ids[0] || INITIAL_LEAGUE_ID;
}

/**
 * Gets the league ID for a specific season
 */
export async function getLeagueIdForSeason(season: string): Promise<string | null> {
  const ids = await getLinkedLeagueIds();

  for (const id of ids) {
    try {
      const leagueInfo = await getLeagueInfo(id);
      if (leagueInfo && String(leagueInfo.season) === String(season)) {
        return id;
      }
    } catch {
      continue;
    }
  }

  return null;
}