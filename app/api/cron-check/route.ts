import { webpush } from '@/lib/web-push-config';
import { getAllSubscriptions, removeSubscription } from '@/lib/push-store';

/**
 * Cron endpoint: revisa todas las suscripciones y envía push notifications
 * para metas cuyo horario coincida con el HH:MM actual del usuario.
 *
 * Protegido con header Authorization: Bearer <CRON_SECRET>.
 * Vercel Cron envía GET automáticamente cada minuto (vercel.json).
 */

async function handleCron(request: Request) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const entries = await getAllSubscriptions();
  let sent = 0;
  let failed = 0;
  const debug: { timezone: string; localTime: string; goalsChecked: number; due: string[] }[] = [];

  for (const entry of entries) {
    // Convertir UTC al timezone local del usuario
    const tz = entry.timezone || 'UTC';
    const localTime = now.toLocaleTimeString('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }); // "HH:MM"

    const dueGoals = entry.goals.filter((g) => g.time === localTime);
    debug.push({
      timezone: tz,
      localTime,
      goalsChecked: entry.goals.length,
      due: dueGoals.map((g) => `${g.icon} ${g.name} @ ${g.time}`),
    });

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
          // Suscripción expirada — eliminar
          await removeSubscription(entry.subscription.endpoint);
        }
        failed++;
      }
    }
  }

  return Response.json({ utc: now.toISOString(), sent, failed, checked: entries.length, debug });
}

// Vercel Cron usa GET
export async function GET(request: Request) {
  return handleCron(request);
}

// Trigger manual usa POST
export async function POST(request: Request) {
  return handleCron(request);
}
