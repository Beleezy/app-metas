import { webpush } from '@/lib/web-push-config';
import type { PushSubscription } from '@/lib/push-store';

export async function POST(request: Request) {
  try {
    const { subscription, payload } = (await request.json()) as {
      subscription: PushSubscription;
      payload: { title: string; body: string; icon?: string; tag?: string };
    };

    if (!subscription?.endpoint) {
      return Response.json({ error: 'Missing subscription' }, { status: 400 });
    }

    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );

    return Response.json({ success: true });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    // 410 Gone or 404 = subscription expired/invalid
    if (statusCode === 410 || statusCode === 404) {
      return Response.json({ error: 'Subscription expired' }, { status: 410 });
    }
    console.error('Push send error:', err);
    return Response.json({ error: 'Failed to send push' }, { status: 500 });
  }
}
