import { NextResponse } from 'next/server';
import { isAIConfigured } from '@/lib/ai/claude';
import { writeArticle, writeTweet } from '@/lib/ai/generate';
import {
  addPost,
  getPersonalities,
  lastGeneratedAt,
  lastPublishAt,
  type FeedPost,
} from '@/lib/ai/store';
import type { Personality } from '@/lib/ai/personalities';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const num = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

const POSTS_PER_RUN    = Math.min(num('AI_POSTS_PER_DAY', 4), 8);
const ARTICLES_PER_RUN = Math.min(num('AI_ARTICLES_PER_DAY', 1), POSTS_PER_RUN);
const SPREAD_HOURS     = num('AI_SPREAD_HOURS', 22);
const RERUN_GUARD_MS   = num('AI_RERUN_GUARD_HOURS', 12) * 60 * 60 * 1000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function scheduleTimes(count: number, startAt: number): number[] {
  const window = SPREAD_HOURS * 60 * 60 * 1000;
  const slot = window / count;
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? startAt : Math.round(startAt + i * slot + Math.random() * slot * 0.8),
  );
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAIConfigured()) {
    return NextResponse.json({ skipped: 'ai-not-configured' });
  }

  const force = new URL(request.url).searchParams.get('force') === '1';
  const sinceGenerated = Date.now() - (await lastGeneratedAt());
  if (!force && sinceGenerated < RERUN_GUARD_MS) {
    return NextResponse.json({
      skipped: 'already-ran-today',
      hoursSinceLastBatch: Math.round(sinceGenerated / 3_600_000),
    });
  }

  const people = (await getPersonalities()).filter(p => p.enabled);
  if (!people.length) return NextResponse.json({ skipped: 'no-enabled-personalities' });

  const articleWriters = people.filter(p => p.kinds.includes('article'));
  const postWriters    = people.filter(p => p.kinds.includes('tweet'));
  if (!postWriters.length && !articleWriters.length) {
    return NextResponse.json({ skipped: 'no-personality-writes-these-kinds' });
  }

  const pendingUntil = await lastPublishAt();
  const hasBacklog = pendingUntil > Date.now();
  const startAt = hasBacklog ? pendingUntil + 60_000 : Date.now();
  const times = scheduleTimes(POSTS_PER_RUN, startAt);

  const plan: { kind: 'article' | 'tweet'; persona: Personality }[] = [];
  const rotation = [...people].sort(() => Math.random() - 0.5);
  for (let i = 0; i < POSTS_PER_RUN; i++) {
    const wantArticle = i < ARTICLES_PER_RUN && articleWriters.length > 0;
    const pool = wantArticle ? articleWriters : (postWriters.length ? postWriters : articleWriters);
    const persona = rotation.find(p => pool.includes(p) && !plan.some(x => x.persona.id === p.id)) ?? pick(pool);
    plan.push({ kind: wantArticle ? 'article' : 'tweet', persona });
  }

  const written: { kind: string; persona: string; publishAt: string }[] = [];
  const failures: string[] = [];

  for (let i = 0; i < plan.length; i++) {
    const { kind, persona } = plan[i];
    try {
      // Dynamic topic injection forcing variety per post generation slot
      const topics = [
        'Focus specifically on recent head-to-head matchup outcomes, close scores, or blowouts from the latest slate.',
        'Focus strictly on waiver wire claims, recent player movement, or roster additions across the league.',
        'Focus on team standing shifts, points for/against standings anomalies, or playoff race positioning.',
        'Focus on standout individual player performances or underperforming stars based on current stats.'
      ];
      const assignedTopic = topics[i % topics.length];

      const content = kind === 'article' 
        ? await writeArticle(persona, assignedTopic) 
        : await writeTweet(persona, assignedTopic);

      const post: FeedPost = {
        id: `${Date.now()}-${persona.id}-${i}`,
        personalityId: persona.id,
        personaName: persona.name,
        personaHandle: persona.handle,
        personaAccent: persona.accent,
        kind,
        content: content as any,
        createdAt: new Date().toISOString(),
        publishAt: new Date(times[i]).toISOString(),
        source: 'cron',
      };

      await addPost(post);
      written.push({ kind, persona: persona.name, publishAt: post.publishAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[api/ai/cron] ${persona.name}/${kind} failed:`, msg);
      failures.push(`${persona.name}/${kind}: ${msg}`);
      if (/storage is not writable/i.test(msg)) break;
    }
  }

  if (!written.length) {
    return NextResponse.json(
      { posted: 0, error: failures[0] ?? 'nothing generated', failures },
      { status: 500 },
    );
  }

  return NextResponse.json({
    posted: written.length,
    requested: POSTS_PER_RUN,
    spreadHours: SPREAD_HOURS,
    written,
    ...(failures.length ? { failures } : {}),
  });
}