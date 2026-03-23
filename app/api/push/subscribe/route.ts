import { saveSubscription, removeSubscription } from '@/lib/push-store';
import type { PushSubscription, StoredGoal } from '@/lib/push-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription, goals, timezone } = body as {
      subscription: PushSubscription;
      goals: StoredGoal[];
      timezone?: string;
    };

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return Response.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    await saveSubscription(subscription, goals || [], timezone || 'UTC');

    return Response.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return Response.json({ error: 'Failed to subscribe', detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) {
      return Response.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    await removeSubscription(endpoint);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
