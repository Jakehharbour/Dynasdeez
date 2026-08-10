'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MatchupDetailModal, { type MatchupTarget } from '@/components/matchup/MatchupDetailModal';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import { 
  getLeagueInfo, 
  getLeagueRosters, 
  getLeagueUsers, 
  getLeagueMatchups, 
  getNFLState, 
  getAllLeagueSeasons, 
  getAllLinkedLeagueIds 
} from '@/lib/api';
import { INITIAL_LEAGUE_ID, getCurrentLeagueId } from '@/config/league';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingPage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/Select';
import { SeasonSelect } from '@/components/ui/SeasonSelect';
import { getDefaultSeason } from '@/lib/utils';
import type { SleeperMatchup } from '@/types/sleeper';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react';

interface MatchupsViewProps {
  currentWeek?: number;
}

export default function MatchupsView({ currentWeek: initialWeek }: MatchupsViewProps) {
  const [openMatchup, setOpenMatchup] = useState<MatchupTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [rosters, setRosters] = useState<any[]>([]);
  const [matchups, setMatchups] = useState<SleeperMatchup[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek || 1);
  const [nflState, setNFLState] = useState<any>(null);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasonRosters, setSeasonRosters] = useState<any[]>([]);
  const [loadingSeasonData, setLoadingSeasonData] = useState(false);

  // Initial setup load
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!INITIAL_LEAGUE_ID || INITIAL_LEAGUE_ID === 'YOUR_LEAGUE_ID') {
        setError('Please set your Sleeper league ID in the .env.local file.');
        setLoading(false);
        return;
      }

      try {
        const leagueId = await getCurrentLeagueId();

        const [leagueData, allSeasons, usersData, rostersData, nflStateData] = await Promise.all([
          getLeagueInfo(leagueId),
          getAllLeagueSeasons(leagueId),
          getLeagueUsers(leagueId),
          getLeagueRosters(leagueId),
          getNFLState(),
        ]);

        const defaultSeason = getDefaultSeason(allSeasons, leagueData.draft_id);

        setLeague(leagueData);
        setUsers(usersData);
        setRosters(rostersData);
        setNFLState(nflStateData);
        setSeasons(allSeasons);
        setSelectedSeason(defaultSeason);
        setSeasonRosters(rostersData);

        // Determine default week
        if (!initialWeek) {
          const currentWeek = nflStateData?.season_type === 'regular' ? nflStateData.week : 1;
          setSelectedWeek(leagueData.status === 'in_season' ? currentWeek : 1);
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch league data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [initialWeek]);

  // Fetch season & week matchups whenever season or week updates
  useEffect(() => {
    const fetchSeasonAndMatchupsData = async () => {
      if (!selectedSeason || !league) return;

      setLoadingSeasonData(true);
      try {
        let targetLeagueId = league.league_id;

        // Only search linked leagues if viewing a historical season
        if (selectedSeason !== league.season) {
          const linkedLeagues = await getAllLinkedLeagueIds(league.league_id);
          for (const id of linkedLeagues) {
            const info = await getLeagueInfo(id);
            if (info.season === selectedSeason) {
              targetLeagueId = id;
              break;
            }
          }
        }

        const [seasonRostersData, matchupsData] = await Promise.all([
          targetLeagueId === league.league_id ? Promise.resolve(rosters) : getLeagueRosters(targetLeagueId),
          getLeagueMatchups(targetLeagueId, selectedWeek),
        ]);

        setSeasonRosters(seasonRostersData);
        setMatchups(matchupsData);
      } catch (err) {
        console.error('Failed to fetch season/matchup data:', err);
        setSeasonRosters(rosters);
      } finally {
        setLoadingSeasonData(false);
      }
    };

    fetchSeasonAndMatchupsData();
  }, [selectedSeason, selectedWeek, league, rosters]);

  if (loading) return <LoadingPage />;
  if (error) return <ErrorMessage title="Error" message={error} />;
  if (!league || !users.length || !rosters.length) return null;

  // Group matchups by matchup_id
  const groupedMatchups = matchups.reduce((acc, matchup) => {
    if (!matchup.matchup_id) return acc;
    if (!acc[matchup.matchup_id]) acc[matchup.matchup_id] = [];
    acc[matchup.matchup_id].push(matchup);
    return acc;
  }, {} as Record<string, SleeperMatchup[]>);

  const finalGroupedMatchups = Object.keys(groupedMatchups)
    .sort((a, b) => Number(a) - Number(b))
    .reduce((acc, key) => {
      acc[key] = groupedMatchups[key];
      return acc;
    }, {} as Record<string, SleeperMatchup[]>);

  const isPlayoffWeek = selectedWeek >= (league?.settings?.playoff_week_start || 15);
  const isCurrentWeek = selectedWeek === nflState?.week && selectedSeason === league?.season;

  const context = {
    title: `Week ${selectedWeek}: ${isPlayoffWeek ? 'Playoffs' : 'Regular Season'}`,
    subtitle: isPlayoffWeek
      ? isCurrentWeek ? 'Championship dreams on the line' : 'Playoff battles.'
      : isCurrentWeek ? "This week's matchups" : 'Head-to-head battles.',
  };

  const hasMatchups = Object.keys(finalGroupedMatchups).length > 0;

  return (
    <div className="space-y-6">
      {/* Week Control Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 md:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            {isPlayoffWeek ? (
              <Trophy className="h-5 w-5 text-primary" />
            ) : (
              <Flame className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground md:text-xl">{context.title}</h2>
            <p className="text-sm text-muted-foreground">{context.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <SeasonSelect
              seasons={seasons}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
              className="flex-1 sm:flex-none sm:w-[140px]"
            />
            <Select
              value={selectedWeek.toString()}
              onValueChange={(value) => setSelectedWeek(Number(value))}
            >
              <SelectTrigger className="flex-1 sm:flex-none sm:w-[160px]">
                Week {selectedWeek}
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 18 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    Week {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setSelectedWeek((prev) => Math.max(1, prev - 1))}
                disabled={selectedWeek <= 1}
                className="rounded-lg border border-border p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSelectedWeek((prev) => Math.min(18, prev + 1))}
                disabled={selectedWeek >= 18}
                className="rounded-lg border border-border p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {hasMatchups && (
            <span className="text-xs text-muted-foreground">
              {Object.keys(finalGroupedMatchups).length} matchups
            </span>
          )}
        </div>
      </motion.div>

      {/* Matchups Content */}
      {loadingSeasonData ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : !hasMatchups ? (
        <Card>
          <CardContent className="text-center py-16">
            <div className="text-muted-foreground">
              <Flame className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No Matchups Available</h3>
              <p className="text-sm">Week {selectedWeek} in Season {selectedSeason} has no scheduled matchups.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="grid gap-4 md:gap-5 lg:grid-cols-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {Object.values(finalGroupedMatchups).map((matchup, index) => {
            const [team1, team2] = matchup;
            if (!team1 || !team2) return null;

            const roster1 = seasonRosters.find((r) => r.roster_id === team1.roster_id);
            const roster2 = seasonRosters.find((r) => r.roster_id === team2.roster_id);
            const user1 = users.find((u) => u.user_id === roster1?.owner_id);
            const user2 = users.find((u) => u.user_id === roster2?.owner_id);

            if (!roster1 || !roster2 || !user1 || !user2) return null;

            const team1Points = team1.points ?? 0;
            const team2Points = team2.points ?? 0;
            const matchupComplete = team1.points !== null && team2.points !== null && (team1Points > 0 || team2Points > 0);
            const team1Winning = team1Points > team2Points;
            const team2Winning = team2Points > team1Points;
            const isTie = matchupComplete && team1Points === team2Points;
            const totalPoints = team1Points + team2Points;
            const pointDifference = Math.abs(team1Points - team2Points);

            return (
              <motion.div
                key={team1.matchup_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {isPlayoffWeek ? 'Playoff Match' : 'Matchup'}
                        </h3>
                        {matchupComplete && (
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            Final
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setOpenMatchup({
                          a: { userId: user1.user_id, teamName: user1.metadata?.team_name || user1.display_name, avatar: user1.avatar },
                          b: { userId: user2.user_id, teamName: user2.metadata?.team_name || user2.display_name, avatar: user2.avatar },
                        })}
                        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        Details
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="space-y-px">
                      {/* Team 1 */}
                      <TeamCardRow 
                        user={user1} 
                        roster={roster1} 
                        points={team1Points} 
                        isWinner={matchupComplete && team1Winning}
                        isTie={isTie && matchupComplete}
                        pointDifference={pointDifference}
                        matchupComplete={matchupComplete}
                      />

                      {/* Divider */}
                      <div className="relative py-1.5">
                        <div className="absolute inset-0 flex items-center px-4">
                          <div className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-background px-3 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
                            {matchupComplete ? (isTie ? 'TIE' : 'FINAL') : 'VS'}
                          </span>
                        </div>
                      </div>

                      {/* Team 2 */}
                      <TeamCardRow 
                        user={user2} 
                        roster={roster2} 
                        points={team2Points} 
                        isWinner={matchupComplete && team2Winning}
                        isTie={isTie && matchupComplete}
                        pointDifference={pointDifference}
                        matchupComplete={matchupComplete}
                      />
                    </div>

                    {/* Summary */}
                    {matchupComplete && (
                      <div className="px-4 py-3 md:px-5 bg-muted/40 border-t border-border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Total: <span className="font-semibold text-foreground">{totalPoints.toFixed(1)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Margin: <span className="font-semibold text-foreground">{pointDifference.toFixed(1)}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <MatchupDetailModal target={openMatchup} onClose={() => setOpenMatchup(null)} />
    </div>
  );
}

// Extracted Sub-component for Team Rows
function TeamCardRow({ user, roster, points, isWinner, isTie, pointDifference, matchupComplete }: any) {
  const totalGames = (roster.settings?.wins || 0) + (roster.settings?.losses || 0) + (roster.settings?.ties || 0);
  const totalFpts = (roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100;
  const avgPoints = (totalFpts / Math.max(1, totalGames)).toFixed(1);

  return (
    <Link 
      href={`/team/${user.user_id}`} 
      className={`flex items-center justify-between p-4 md:p-5 transition-colors duration-200 ${
        isWinner
          ? 'bg-primary/[0.04] border-l-4 border-primary'
          : isTie
          ? 'bg-amber-500/[0.04] border-l-4 border-amber-500'
          : 'border-l-4 border-transparent hover:bg-accent/40'
      }`}
    >
      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
        <Avatar
          avatarId={user.avatar}
          size={40}
          className={`md:w-11 md:h-11 rounded-lg ${
            isWinner ? 'ring-2 ring-primary' : 'ring-1 ring-border'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-sm md:text-base truncate ${isWinner ? 'text-primary' : 'text-foreground'}`}>
            {user.metadata?.team_name || user.display_name}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{roster.settings.wins || 0}-{roster.settings.losses || 0}{roster.settings.ties > 0 ? `-${roster.settings.ties}` : ''}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{avgPoints} avg</span>
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className={`font-display text-2xl md:text-3xl font-bold tabular-nums ${
          isWinner ? 'text-primary' : isTie ? 'text-amber-500' : 'text-foreground'
        }`}>
          {points?.toFixed(1) || '0.0'}
        </div>
        {isWinner && matchupComplete && (
          <div className="text-xs text-primary font-semibold">
            +{pointDifference.toFixed(1)}
          </div>
        )}
      </div>
    </Link>
  );
}