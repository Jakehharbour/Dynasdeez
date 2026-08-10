/**
 * Server-only: theme persistence (Upstash Redis in prod, JSON file in dev).
 * Do NOT import this in client components. Import themeConfig.ts instead.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';
import { type ThemeConfig, type FontPairKey, DEFAULT_THEME, fontPairs, accentPresets } from './themeConfig';

// Re-export everything from themeConfig for convenience
export { DEFAULT_THEME, fontPairs, accentPresets };
export type { ThemeConfig, FontPairKey };

// ─── Storage backend ───────────────────────────────────────────────

const url = process.env.dynasdeezstorage_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.dynasdeezstorage_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (url && token) {
  redis = new Redis({ url, token });
}

const DATA_DIR   = path.join(process.cwd(), 'data');
const THEME_FILE = path.join(DATA_DIR, 'theme.json');
const REDIS_KEY  = 'league_theme';

async function ensureDataDir() {
  try { await fs.access(DATA_DIR); }
  catch { await fs.mkdir(DATA_DIR, { recursive: true }); }
}

let memCache: ThemeConfig | null = null;
let memCacheExpiry = 0;
let memCacheMtimeMs = 0;
const MEM_TTL = 1000; // 1s

async function themeFileMtime(): Promise<number> {
  try {
    return (await fs.stat(THEME_FILE)).mtimeMs;
  } catch {
    return 0;
  }
}

export async function getTheme(): Promise<ThemeConfig> {
  if (memCache && Date.now() < memCacheExpiry) {
    if (redis || (await themeFileMtime()) === memCacheMtimeMs) return memCache;
  }

  try {
    let theme: ThemeConfig | null = null;

    if (redis) {
      const raw = await redis.get<ThemeConfig>(REDIS_KEY);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        theme = { ...DEFAULT_THEME, ...parsed };
      }
    } else {
      await ensureDataDir();
      try {
        const raw = await fs.readFile(THEME_FILE, 'utf-8');
        theme = { ...DEFAULT_THEME, ...JSON.parse(raw) };
      } catch { /* file doesn't exist yet */ }
    }

    const result = theme ?? { ...DEFAULT_THEME };
    memCache = result;
    memCacheExpiry = Date.now() + MEM_TTL;
    memCacheMtimeMs = await themeFileMtime();
    return result;
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export async function saveTheme(theme: Partial<ThemeConfig>): Promise<ThemeConfig> {
  const current = await getTheme();
  const next: ThemeConfig = { ...current, ...theme };
  try {
    if (redis) {
      await redis.set(REDIS_KEY, next);
    } else {
      await ensureDataDir();
      await fs.writeFile(THEME_FILE, JSON.stringify(next, null, 2));
    }
  } catch (err) {
    console.error('themeStorage.saveTheme error:', err);
  }

  // Bust in-memory cache so the new theme is served immediately
  memCache = next;
  memCacheExpiry = Date.now() + MEM_TTL;
  memCacheMtimeMs = await themeFileMtime();
  return next;
}

export async function resetTheme(): Promise<ThemeConfig> {
  return saveTheme(DEFAULT_THEME);
}