import { Redis } from '@upstash/redis';

/**
 * Push subscription store using Upstash Redis.
 *
 * Supports env vars from both Vercel Redis and Upstash directly:
 *   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (Upstash default)
 *   - KV_REST_API_URL / KV_REST_API_TOKEN                (Vercel KV)
 *   - REDIS_REST_URL / REDIS_REST_TOKEN                   (Vercel Redis custom)
 */

const url =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  process.env.REDIS_REST_URL ||
  '';

const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.REDIS_REST_TOKEN ||
  '';

const redis = new Redis({ url, token });

export { redis };

// ── Types ──────────────────────────────────────────────

export interface StoredGoal {
  id: string;
  name: string;
  time: string; // "HH:MM"
  icon: string;
}

export interface SubscriptionEntry {
  subscription: PushSubscription;
  goals: StoredGoal[];
  updatedAt: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ── Store operations ───────────────────────────────────

const HASH_KEY = 'push:subs';

function endpointId(endpoint: string): string {
  return endpoint.slice(-32);
}

export async function saveSubscription(
  subscription: PushSubscription,
  goals: StoredGoal[]
) {
  const entry: SubscriptionEntry = {
    subscription,
    goals,
    updatedAt: new Date().toISOString(),
  };
  await redis.hset(HASH_KEY, { [endpointId(subscription.endpoint)]: JSON.stringify(entry) });
}

export async function removeSubscription(endpoint: string) {
  await redis.hdel(HASH_KEY, endpointId(endpoint));
}

export async function getAllSubscriptions(): Promise<SubscriptionEntry[]> {
  const all = await redis.hgetall<Record<string, string>>(HASH_KEY);
  if (!all) return [];
  return Object.values(all).map((v) => {
    if (typeof v === 'string') return JSON.parse(v);
    return v as unknown as SubscriptionEntry;
  });
}
