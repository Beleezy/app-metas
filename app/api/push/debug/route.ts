import { list } from '@vercel/blob';
import { getAllSubscriptions } from '@/lib/push-store';
import { webpush } from '@/lib/web-push-config';

/**
 * GET  /api/push/debug         — diagnostic info
 * POST /api/push/debug         — send a test push to all subscribers
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  checks.vapid = {
    publicKey: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: !!process.env.VAPID_PRIVATE_KEY,
    email: process.env.VAPID_EMAIL || '(not set)',
  };

  checks.blobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const result = await list({ prefix: 'push-subs', limit: 1 });
    checks.blobConnection = `OK (${result.blobs.length} blobs found)`;
  } catch (err: unknown) {
    checks.blobConnection = `FAILED: ${(err as Error).message}`;
  }

  try {
    const subs = await getAllSubscriptions();
    checks.subscriptions = {
      count: subs.length,
      entries: subs.map((s) => ({
        endpoint: '...' + s.subscription.endpoint.slice(-30),
        timezone: s.timezone || '(not set)',
        goals: s.goals.map((g) => `${g.icon} ${g.name} @ ${g.time}`),
        updatedAt: s.updatedAt,
      })),
    };
  } catch (err: unknown) {
    checks.subscriptions = `FAILED: ${(err as Error).message}`;
  }

  checks.cronSecret = !!process.env.CRON_SECRET;

  const now = new Date();
  checks.serverTime = {
    utc: now.toISOString(),
    currentHHMM: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return Response.json(checks, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST() {
  const subs = await getAllSubscriptions();
  if (subs.length === 0) {
    return Response.json({ error: 'No subscriptions found' }, { status: 404 });
  }

  const results: { endpoint: string; status: string }[] = [];

  for (const entry of subs) {
    const payload = JSON.stringify({
      title: 'Metas Diarias — Test',
      body: '🔔 Si ves esto, las push notifications funcionan!',
      icon: '/icons/icon-192x192.png',
      tag: 'test-push',
    });

    try {
      await webpush.sendNotification(entry.subscription, payload);
      results.push({ endpoint: '...' + entry.subscription.endpoint.slice(-20), status: 'OK' });
    } catch (err: unknown) {
      results.push({ endpoint: '...' + entry.subscription.endpoint.slice(-20), status: `FAILED: ${(err as Error).message}` });
    }
  }

  return Response.json({ sent: results });
}
