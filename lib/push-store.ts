import { put, list, del } from '@vercel/blob';

/**
 * Push subscription store using a single Vercel Blob file.
 * All subscriptions live in one JSON blob: "push-subs.json"
 */

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
  timezone: string;
  updatedAt: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

type Store = Record<string, SubscriptionEntry>;

// ── Helpers ────────────────────────────────────────────

const BLOB_PATH = 'push-subs.json';

function endpointId(endpoint: string): string {
  return endpoint.slice(-32).replace(/[^a-zA-Z0-9]/g, '_');
}

async function readStore(): Promise<Store> {
  try {
    const result = await list({ prefix: BLOB_PATH });
    if (result.blobs.length === 0) return {};

    const blob = result.blobs[0];
    // Private blobs require the token header for server-side reads
    const res = await fetch(blob.url, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(store), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

// ── Store operations ───────────────────────────────────

export async function saveSubscription(
  subscription: PushSubscription,
  goals: StoredGoal[],
  timezone: string = 'UTC'
) {
  const store = await readStore();
  store[endpointId(subscription.endpoint)] = {
    subscription,
    goals,
    timezone,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
}

export async function removeSubscription(endpoint: string) {
  const store = await readStore();
  delete store[endpointId(endpoint)];
  await writeStore(store);
}

export async function getAllSubscriptions(): Promise<SubscriptionEntry[]> {
  const store = await readStore();
  return Object.values(store);
}
