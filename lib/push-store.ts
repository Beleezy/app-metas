import { getServiceSupabase } from './supabase';

/**
 * Push subscription store backed by Supabase.
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

// ── Store operations ───────────────────────────────────

export async function saveSubscription(
  subscription: PushSubscription,
  goals: StoredGoal[],
  timezone: string = 'UTC',
  deviceId?: string
) {
  const db = getServiceSupabase();

  const { error } = await db.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      goals,  // jsonb column — pass array directly, no JSON.stringify
      timezone,
      device_id: deviceId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('saveSubscription error:', error);
    throw error;
  }
}

export async function removeSubscription(endpoint: string) {
  const db = getServiceSupabase();
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) console.error('removeSubscription error:', error);
}

export async function getAllSubscriptions(): Promise<SubscriptionEntry[]> {
  const db = getServiceSupabase();
  const { data, error } = await db.from('push_subscriptions').select('*');

  if (error) {
    console.error('getAllSubscriptions error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => ({
    subscription: {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    },
    goals: Array.isArray(row.goals) ? row.goals : [],
    timezone: row.timezone,
    updatedAt: row.updated_at,
  }));
}
