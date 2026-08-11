'use client';

import { useEffect, useState } from 'react';
import type { PowerRankingEntry } from '@/lib/powerRankings';

export default function PowerRankingsPage() {
  const [season, setSeason] = useState('2024');
  const [rankings, setRankings] = useState<PowerRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const seasonsList = ['2024', '2023', '2022', '2021'];

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
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
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
    </div>
  );
}