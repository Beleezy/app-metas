import { put, list, del } from '@vercel/blob';

/**
 * Push subscription store using Vercel Blob.
 *
 * Each subscription is stored as a separate JSON blob at:
 *   push-subs/<endpointId>.json
 *
 * Vercel injects BLOB_READ_WRITE_TOKEN automatically when linked.
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
  updatedAt: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ── Helpers ────────────────────────────────────────────

const PREFIX = 'push-subs/';

function endpointId(endpoint: string): string {
  // Last 32 chars of the push endpoint are unique per device
  return endpoint.slice(-32).replace(/[^a-zA-Z0-9]/g, '_');
}

function blobPath(endpoint: string): string {
  return `${PREFIX}${endpointId(endpoint)}.json`;
}

// ── Store operations ───────────────────────────────────

export async function saveSubscription(
  subscription: PushSubscription,
  goals: StoredGoal[]
) {
  const entry: SubscriptionEntry = {
    subscription,
    goals,
    updatedAt: new Date().toISOString(),
  };

  await put(blobPath(subscription.endpoint), JSON.stringify(entry), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export async function removeSubscription(endpoint: string) {
  try {
    const blobs = await list({ prefix: blobPath(endpoint) });
    for (const blob of blobs.blobs) {
      await del(blob.url);
    }
  } catch {
    // Already deleted or not found — no-op
  }
}

export async function getAllSubscriptions(): Promise<SubscriptionEntry[]> {
  const entries: SubscriptionEntry[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({ prefix: PREFIX, cursor });
    for (const blob of result.blobs) {
      try {
        const res = await fetch(blob.url);
        if (res.ok) {
          entries.push(await res.json());
        }
      } catch {
        // Skip corrupted blobs
      }
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return entries;
}
