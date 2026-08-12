'use client';

import { useEffect, useState } from 'react';

interface RecapData {
  week: number;
  nextWeek: number;
  stats: {
    highest: { team: string; score: number };
    lowest: { team: string; score: number };
    biggestBlowout: { winner: string; loser: string; margin: number };
  };
  aiOutput: {
    generalRecap: string;
    matchRecaps: { matchup: string; recap: string }[];
    transactionSummary: string;
    previews: { matchup: string; storyline: string }[];
  };
}

export default function RecapPage() {
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recap')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load recap');
        return json;
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-foreground">
        <p className="text-xl animate-pulse">Loading fantasy football breakdown...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-6">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Error Loading Recap</h1>
        <p className="text-muted-foreground">{error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8 bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Week {data.week} League Recap</h1>
        <p className="text-muted-foreground">Commissioner AI Breakdown & Matchup Analysis</p>
      </header>

      {/* General Recap */}
      <section className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold mb-3 text-primary">Dynasdeez Recap</h2>
        <p className="text-card-foreground leading-relaxed">{data.aiOutput?.generalRecap}</p>
      </section>

      {/* Key Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Highest Score</p>
          <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400 mt-1">{data.stats?.highest?.team}</p>
          <p className="text-2xl font-extrabold">{data.stats?.highest?.score} pts</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Lowest Score</p>
          <p className="text-lg font-bold text-rose-500 dark:text-rose-400 mt-1">{data.stats?.lowest?.team}</p>
          <p className="text-2xl font-extrabold">{data.stats?.lowest?.score} pts</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Biggest Blowout</p>
          <p className="text-sm font-bold text-amber-500 dark:text-amber-400 mt-1">
            {data.stats?.biggestBlowout?.winner} over {data.stats?.biggestBlowout?.loser}
          </p>
          <p className="text-xl font-extrabold">+{data.stats?.biggestBlowout?.margin?.toFixed(1)} pts</p>
        </div>
      </section>

      {/* Match Recaps */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Matchup Breakdowns</h2>
        <div className="grid grid-cols-1 gap-4">
          {data.aiOutput.matchRecaps.map((m, idx) => (
            <div key={idx} className="bg-card border border-border p-5 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg text-primary">{m.matchup}</h3>
              <p className="text-card-foreground mt-1">{m.recap}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Transactions */}
      <section className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold mb-2 text-primary">Waivers & Trades</h2>
        <p className="text-card-foreground">{data.aiOutput.transactionSummary}</p>
      </section>

      {/* Next Week Previews */}
      <section className="space-y-4 pb-12">
        <h2 className="text-2xl font-bold">Dynasteez Preview</h2>
        <div className="grid grid-cols-1 gap-4">
          {data.aiOutput.previews.map((p, idx) => (
            <div key={idx} className="bg-card border border-border p-5 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg text-amber-500 dark:text-amber-300">{p.matchup}</h3>
              <p className="text-card-foreground mt-1">{p.storyline}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}