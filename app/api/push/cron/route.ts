import { webpush } from '@/lib/web-push-config';
import { getAllSubscriptions, removeSubscription } from '@/lib/push-store';

/**
 * Cron endpoint: checks all subscriptions and sends push notifications
 * for goals whose time matches the current HH:MM.
 *
 * Vercel Cron sends GET requests automatically every minute (vercel.json).
 * Can also be called manually via POST.
 */

async function handleCron(request: Request) {
  // Protect with CRON_SECRET (Vercel injects this header automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const nowH = now.getHours().toString().padStart(2, '0');
  const nowM = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${nowH}:${nowM}`;

  const entries = await getAllSubscriptions();
  let sent = 0;
  let failed = 0;

  for (const entry of entries) {
    const dueGoals = entry.goals.filter((g) => g.time === currentTime);
    if (dueGoals.length === 0) continue;

    for (const goal of dueGoals) {
      const payload = JSON.stringify({
        title: 'Metas Diarias',
        body: `${goal.icon} ${goal.name}`,
        icon: '/icons/icon-192x192.png',
        tag: goal.id,
      });

      try {
        await webpush.sendNotification(entry.subscription, payload);
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await removeSubscription(entry.subscription.endpoint);
        }
        failed++;
      }
    }
  }

  return Response.json({ time: currentTime, sent, failed });
}

// Vercel Cron uses GET
export async function GET(request: Request) {
  return handleCron(request);
}

// Manual trigger uses POST
export async function POST(request: Request) {
  return handleCron(request);
}
