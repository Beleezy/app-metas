import { list } from '@vercel/blob';
import { getAllSubscriptions } from '@/lib/push-store';

/**
 * Diagnostic endpoint.
 * Visit: https://tu-app.vercel.app/api/push/debug
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  // 1. VAPID keys configured?
  checks.vapid = {
    publicKey: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: !!process.env.VAPID_PRIVATE_KEY,
    email: process.env.VAPID_EMAIL || '(not set)',
  };

  // 2. Blob token present?
  checks.blobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  // 3. Blob connection works?
  try {
    const result = await list({ prefix: 'push-subs', limit: 1 });
    checks.blobConnection = `OK (${result.blobs.length} blobs found)`;
  } catch (err: unknown) {
    checks.blobConnection = `FAILED: ${(err as Error).message}`;
  }

  // 4. Subscriptions stored?
  try {
    const subs = await getAllSubscriptions();
    checks.subscriptions = {
      count: subs.length,
      entries: subs.map((s) => ({
        endpoint: '...' + s.subscription.endpoint.slice(-30),
        goals: s.goals.map((g) => `${g.icon} ${g.name} @ ${g.time}`),
        updatedAt: s.updatedAt,
      })),
    };
  } catch (err: unknown) {
    checks.subscriptions = `FAILED: ${(err as Error).message}`;
  }

  // 5. Cron secret?
  checks.cronSecret = !!process.env.CRON_SECRET;

  // 6. Server time (cron matches against this)
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
