import { kv } from '@vercel/kv';

/**
 * Push subscription store using Vercel KV (Redis).
 *
 * Each subscription is stored as a hash entry under the key "push:subs".
 * The hash field is a short ID derived from the endpoint.
 * This ensures persistence across serverless invocations.
 */

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

const HASH_KEY = 'push:subs';

// Short stable ID from an endpoint URL
function endpointId(endpoint: string): string {
  // Use last 32 chars of endpoint as unique key (push service token part)
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
  await kv.hset(HASH_KEY, { [endpointId(subscription.endpoint)]: JSON.stringify(entry) });
}

export async function removeSubscription(endpoint: string) {
  await kv.hdel(HASH_KEY, endpointId(endpoint));
}

export async function getAllSubscriptions(): Promise<SubscriptionEntry[]> {
  const all = await kv.hgetall<Record<string, string>>(HASH_KEY);
  if (!all) return [];
  return Object.values(all).map((v) => {
    if (typeof v === 'string') return JSON.parse(v);
    return v as unknown as SubscriptionEntry;
  });
}
