import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDefaultSeason(
  seasons: string[], 
  hasCurrentSeasonData: boolean = false
): string {
  if (!seasons.length) return new Date().getFullYear().toString();

  // Sort seasons descending (e.g., ['2026', '2025', '2024', '2023'])
  const sortedSeasons = seasons
    .map(Number)
    .filter((s) => !isNaN(s))
    .sort((a, b) => b - a);

  const highestSeason = sortedSeasons[0];

  // If 2026 has active games/matchups generated, default to it immediately
  if (hasCurrentSeasonData) {
    return highestSeason.toString();
  }

  // Otherwise, default to the most recent completed/playable season during offseason
  const currentYear = new Date().getFullYear();
  const completedSeason = sortedSeasons.find((s) => s < currentYear);

  return (completedSeason || highestSeason).toString();
}

export function getDefaultValue<T>(value: T | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined || Number.isNaN(value as number)) {
    return defaultValue;
  }
  return value;
}

export function formatPoints(points: number | null | undefined): string {
  const value = getDefaultValue(points, 0);
  return value.toFixed(2);
}

export function calculateWinPercentage(wins: number, losses: number, ties: number): number {
  const totalGames = wins + losses + ties;
  if (totalGames === 0) return 0;
  return ((wins + ties * 0.5) / totalGames) * 100;
}

export function formatRecord(wins: number, losses: number, ties: number = 0): string {
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
}