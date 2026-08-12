import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// Safely initialize Groq client with fallback
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// TypeScript Interfaces
interface Matchup {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

interface TransactionItem {
  type: 'waiver' | 'trade';
  details: string;
}

interface Stats {
  highest: { team: string; score: number };
  lowest: { team: string; score: number };
  biggestBlowout: { winner: string; loser: string; margin: number };
}

// Helper: Fetch Sleeper players dictionary to resolve player IDs to names
async function getPlayersMap(): Promise<Map<string, string>> {
  const playerMap = new Map<string, string>();
  try {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (res.ok) {
      const data = await res.json();
      for (const [id, info] of Object.entries(data as Record<string, any>)) {
        const fullName = info?.full_name || info?.search_full_name || id;
        playerMap.set(id, fullName);
      }
    }
  } catch (error) {
    console.error('Failed to fetch Sleeper players map:', error);
  }
  return playerMap;
}

// 1. Get Current League State from Sleeper API
async function getLeagueState(leagueId: string) {
  const [leagueRes, nflStateRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
    fetch('https://api.sleeper.app/v1/state/nfl'),
  ]);

  if (!leagueRes.ok) {
    throw new Error(`Failed to fetch Sleeper league data (Status: ${leagueRes.status})`);
  }

  const leagueData = await leagueRes.json();
  const nflState = nflStateRes.ok ? await nflStateRes.json() : {};

  return {
    currentWeek: nflState.week || 1,
    leagueName: leagueData.name || 'Our League',
  };
}

// 2. Map Sleeper User Names to Team Rosters
async function getTeamNamesMap(leagueId: string): Promise<Map<number, string>> {
  const [usersRes, rostersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
  ]);

  const users = usersRes.ok ? await usersRes.json() : [];
  const rosters = rostersRes.ok ? await rostersRes.json() : [];

  const userMap = new Map<string, string>();
  users.forEach((u: any) => {
    const metadata = u.metadata as { team_name?: string } | undefined;
    const name = metadata?.team_name || u.display_name || u.username;
    userMap.set(u.user_id, name);
  });

  const rosterToNameMap = new Map<number, string>();
  rosters.forEach((r: any) => {
    const name = userMap.get(r.owner_id) || `Team ${r.roster_id}`;
    rosterToNameMap.set(r.roster_id, name);
  });

  return rosterToNameMap;
}

// 3. Fetch Matchups for a Specific Week
async function getWeeklyMatchups(
  leagueId: string,
  week: number,
  teamNamesMap: Map<number, string>
): Promise<Matchup[]> {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
  if (!res.ok) return [];

  const data = await res.json();
  if (!data || !Array.isArray(data)) return [];

  const grouped = new Map<number, any[]>();
  data.forEach((m: any) => {
    if (!m.matchup_id) return;
    const arr = grouped.get(m.matchup_id) || [];
    arr.push(m);
    grouped.set(m.matchup_id, arr);
  });

  const matchups: Matchup[] = [];
  for (const pair of grouped.values()) {
    if (pair.length === 2) {
      matchups.push({
        homeTeam: teamNamesMap.get(pair[0].roster_id) || `Team ${pair[0].roster_id}`,
        awayTeam: teamNamesMap.get(pair[1].roster_id) || `Team ${pair[1].roster_id}`,
        homeScore: pair[0].points || 0,
        awayScore: pair[1].points || 0,
      });
    }
  }

  return matchups;
}

// 4. Fetch Transactions (Trades & Waivers) for a Specific Week
async function getWeeklyTransactions(
  leagueId: string,
  week: number,
  teamNamesMap: Map<number, string>,
  playerMap: Map<string, string>
): Promise<TransactionItem[]> {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
  if (!res.ok) return [];

  const data = await res.json();
  if (!data || !Array.isArray(data)) return [];

  const transactions: TransactionItem[] = [];

  data.forEach((t: any) => {
    if (t.type === 'trade') {
      const teamNames = t.roster_ids?.map((id: number) => teamNamesMap.get(id) || `Team ${id}`) || [];
      const adds = t.adds || {};
      const tradedAssets = Object.entries(adds)
        .map(([playerId, rosterId]) => {
          const playerName = playerMap.get(playerId) || playerId;
          const targetTeam = teamNamesMap.get(Number(rosterId)) || 'a team';
          return `${playerName} to ${targetTeam}`;
        })
        .join(', ');

      transactions.push({
        type: 'trade',
        details: `Trade between ${teamNames.join(' and ')} involving: ${tradedAssets || 'various assets'}.`,
      });
    } else {
      const primaryRosterId = t.roster_ids?.[0];
      const teamName = teamNamesMap.get(primaryRosterId) || 'A team';
      
      const addedIds = Object.keys(t.adds || {});
      const droppedIds = Object.keys(t.drops || {});

      const addedNames = addedIds.map((id) => playerMap.get(id) || id);
      const droppedNames = droppedIds.map((id) => playerMap.get(id) || id);

      let detailStr = '';
      if (addedNames.length > 0 && droppedNames.length > 0) {
        detailStr = `${teamName} claimed ${addedNames.join(', ')} and dropped ${droppedNames.join(', ')}.`;
      } else if (addedNames.length > 0) {
        detailStr = `${teamName} claimed ${addedNames.join(', ')}${t.settings?.waiver_bid ? ` ($${t.settings.waiver_bid} FAB)` : ''}.`;
      } else if (droppedNames.length > 0) {
        detailStr = `${teamName} dropped ${droppedNames.join(', ')}.`;
      } else {
        detailStr = `${teamName} made a roster transaction.`;
      }

      transactions.push({
        type: 'waiver',
        details: detailStr,
      });
    }
  });

  return transactions;
}

// 5. Calculate Highs, Lows, and Margins
function calculateStats(matchups: Matchup[]): Stats {
  let highest = { team: 'None', score: -1 };
  let lowest = { team: 'None', score: Infinity };
  let biggestBlowout = { winner: 'None', loser: 'None', margin: -1 };

  if (!matchups || matchups.length === 0) {
    return {
      highest: { team: 'N/A', score: 0 },
      lowest: { team: 'N/A', score: 0 },
      biggestBlowout: { winner: 'N/A', loser: 'N/A', margin: 0 },
    };
  }

  matchups.forEach((m) => {
    if (m.homeScore > highest.score) highest = { team: m.homeTeam, score: m.homeScore };
    if (m.awayScore > highest.score) highest = { team: m.awayTeam, score: m.awayScore };

    if (m.homeScore < lowest.score) lowest = { team: m.homeTeam, score: m.homeScore };
    if (m.awayScore < lowest.score) lowest = { team: m.awayTeam, score: m.awayScore };

    const margin = Math.abs(m.homeScore - m.awayScore);
    if (margin > biggestBlowout.margin) {
      const winner = m.homeScore > m.awayScore ? m.homeTeam : m.awayTeam;
      const loser = m.homeScore > m.awayScore ? m.awayTeam : m.homeTeam;
      biggestBlowout = { winner, loser, margin };
    }
  });

  if (lowest.score === Infinity) lowest.score = 0;

  return { highest, lowest, biggestBlowout };
}

// 6. Generate Commentary using Groq AI
async function generateAiRecap(
  pastWeek: number,
  currentWeek: number,
  matchups: Matchup[],
  upcomingMatchups: Matchup[],
  transactions: TransactionItem[],
  stats: Stats
) {
  const waiverItems = transactions.filter((t) => t.type === 'waiver').map((t) => t.details);
  const tradeItems = transactions.filter((t) => t.type === 'trade').map((t) => t.details);

  const fallback = {
    generalRecap: `Week ${pastWeek} was wild! ${stats.highest.team} took top honors with ${stats.highest.score} points, while ${stats.lowest.team} fell short.`,
    matchRecaps: matchups.map((m) => ({
      matchup: `${m.homeTeam} vs ${m.awayTeam}`,
      recap: `${m.homeScore > m.awayScore ? m.homeTeam : m.awayTeam} picked up the win.`,
    })),
    waiverSummary: waiverItems.length > 0 ? waiverItems : ['No waiver moves made this week.'],
    tradeSummary: tradeItems.length > 0 ? tradeItems.map(t => `${t} This helps both teams adjust their depth.`) : ['No trades completed this week.'],
    previews: upcomingMatchups.map((m) => ({
      matchup: `${m.homeTeam} vs ${m.awayTeam}`,
      storyline: `A big battle coming up in Week ${currentWeek}.`,
    })),
  };

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  const prompt = `
    You are a hilarious, witty fantasy football league commissioner. Write a fun weekly recap based on these stats.

    Data for Week ${pastWeek}:
    - Highest Score: ${stats.highest.team} (${stats.highest.score} pts)
    - Lowest Score: ${stats.lowest.team} (${stats.lowest.score} pts)
    - Biggest Blowout: ${stats.biggestBlowout.winner} beat ${stats.biggestBlowout.loser} by ${stats.biggestBlowout.margin.toFixed(1)} pts
    - Matchup Scores: ${JSON.stringify(matchups)}
    - Raw Waivers: ${JSON.stringify(waiverItems)}
    - Raw Trades: ${JSON.stringify(tradeItems)}
    - Next Week (${currentWeek}) Matchups: ${JSON.stringify(upcomingMatchups)}

    Output STRICT JSON matching this exact format:
    {
      "generalRecap": "A funny paragraph summarizing Week ${pastWeek}.",
      "matchRecaps": [
        { "matchup": "Team A vs Team B", "recap": "A short humorous summary of the game." }
      ],
      "waiverSummary": [
        "A bulleted string summarizing a specific waiver claim."
      ],
      "tradeSummary": [
        "A bulleted string explaining a trade and analyzing how it helps each team involved."
      ],
      "previews": [
        { "matchup": "Team A vs Team B", "storyline": "A short hype preview for Week ${currentWeek}." }
      ]
    }
  `;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs strictly raw JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('Groq AI Error:', error);
    return fallback;
  }
}

// 7. Main Next.js API Route Handler
export async function GET() {
  try {
    const leagueId =
      process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID || process.env.NEXT_PUBLIC_LEAGUE_ID || '';

    if (!leagueId) {
      return NextResponse.json(
        { error: 'Missing Sleeper League ID in environment variables.' },
        { status: 400 }
      );
    }

    const { currentWeek } = await getLeagueState(leagueId);
    const pastWeek = Math.max(1, currentWeek - 1);

    const [teamNamesMap, playerMap] = await Promise.all([
      getTeamNamesMap(leagueId),
      getPlayersMap(),
    ]);

    const [pastMatchups, upcomingMatchups, transactions] = await Promise.all([
      getWeeklyMatchups(leagueId, pastWeek, teamNamesMap),
      getWeeklyMatchups(leagueId, currentWeek, teamNamesMap),
      getWeeklyTransactions(leagueId, pastWeek, teamNamesMap, playerMap),
    ]);

    const stats = calculateStats(pastMatchups);
    const aiOutput = await generateAiRecap(
      pastWeek,
      currentWeek,
      pastMatchups,
      upcomingMatchups,
      transactions,
      stats
    );

    return NextResponse.json({
      week: pastWeek,
      nextWeek: currentWeek,
      stats,
      aiOutput,
    });
  } catch (error: any) {
    console.error('Error in /api/recap:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}