'use client';

import { useEffect, useState } from 'react';
import type { PowerRankingEntry } from '@/lib/powerRankings';

export default function PowerRankingsPage() {
  const seasonsList = ['2026', '2025', '2024', '2023', '2022'];
  const [season, setSeason] = useState('2026');
  const [rankings, setRankings] = useState<PowerRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);
      try {
        const res = await fetch(`/api/power-rankings?season=${season}`);
        const data = await res.json();
        if (data.rankings) setRankings(data.rankings);
      } catch (e) {
        console.error('Error loading power rankings:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchRankings();
  }, [season]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">League Power Rankings</h1>
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="bg-gray-800 text-white p-2 rounded-md border border-gray-700"
        >
          {seasonsList.map((s) => (
            <option key={s} value={s}>{s} Season</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Calculating rankings...</div>
      ) : (
        <div className="overflow-x-auto bg-gray-900 rounded-lg shadow border border-gray-800">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="p-4">Rank</th>
                <th className="p-4">Team</th>
                <th className="p-4 text-center">Record</th>
                <th className="p-4 text-center">All-Play</th>
                <th className="p-4 text-right">Points For</th>
                <th className="p-4 text-right">Power Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rankings.map((team) => (
                <tr key={team.userId} className="hover:bg-gray-800/50">
                  <td className="p-4 font-bold text-lg">{team.rank}</td>
                  <td className="p-4 font-medium text-white">{team.teamName}</td>
                  <td className="p-4 text-center">{team.wins}-{team.losses}</td>
                  <td className="p-4 text-center">{team.allPlayWins}-{team.allPlayLosses}</td>
                  <td className="p-4 text-right">{team.pointsFor.toFixed(1)}</td>
                  <td className="p-4 text-right font-bold text-indigo-400">{team.powerScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend & Breakdown Section */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-gray-300 space-y-4">
        <h2 className="text-lg font-semibold text-white">Understanding Power Rankings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-medium text-indigo-400 mb-1">What is All-Play?</h3>
            <p className="text-gray-400 leading-relaxed">
              All-Play simulates your record as if you played against every other manager in the league every week. For example, in a 10-team league, if you score the 3rd highest points in a week, your All-Play record for that week is 7-2.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-indigo-400 mb-1">Power Score Calculation</h3>
            <p className="text-gray-400 mb-2">The score is calculated out of 100 total points using three weighted metrics:</p>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li><strong className="text-gray-200">40% Win %:</strong> Actual head-to-head match record</li>
              <li><strong className="text-gray-200">40% All-Play %:</strong> Record against every team weekly</li>
              <li><strong className="text-gray-200">20% Points For:</strong> Total points relative to the league&apos;s top scorer</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}