import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET    /api/completions?device_id=xxx&date=YYYY-MM-DD  — Obtener completions
 * POST   /api/completions                                — Toggle completion
 * DELETE /api/completions                                — Borrar completions de una fecha
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');
  const date = searchParams.get('date');

  if (!deviceId) {
    return Response.json({ error: 'Missing device_id' }, { status: 400 });
  }

  const db = getServiceSupabase();
  let query = db
    .from('completions')
    .select('*')
    .eq('device_id', deviceId);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Return as { "YYYY-MM-DD": { "goalId": true, ... } }
  const grouped: Record<string, Record<string, boolean>> = {};
  for (const row of data || []) {
    if (!grouped[row.date]) grouped[row.date] = {};
    grouped[row.date][row.goal_id] = row.completed;
  }

  return Response.json(grouped);
}

export async function POST(request: Request) {
  try {
    const { device_id, goal_id, date, completed } = await request.json() as {
      device_id: string;
      goal_id: string;
      date: string;
      completed: boolean;
    };

    if (!device_id || !goal_id || !date) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getServiceSupabase();

    if (completed) {
      await db.from('completions').upsert(
        { device_id, goal_id, date, completed: true },
        { onConflict: 'device_id,goal_id,date' }
      );
    } else {
      await db
        .from('completions')
        .delete()
        .eq('device_id', device_id)
        .eq('goal_id', goal_id)
        .eq('date', date);
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { device_id, date } = await request.json() as {
      device_id: string;
      date: string;
    };

    if (!device_id || !date) {
      return Response.json({ error: 'Missing device_id or date' }, { status: 400 });
    }

    const db = getServiceSupabase();
    await db
      .from('completions')
      .delete()
      .eq('device_id', device_id)
      .eq('date', date);

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
