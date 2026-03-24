import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET  /api/goals?device_id=xxx  — Obtener todas las metas de un dispositivo
 * POST /api/goals                — Crear o actualizar metas (bulk upsert)
 * DELETE /api/goals              — Eliminar una meta
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');

  if (!deviceId) {
    return Response.json({ error: 'Missing device_id' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('goals')
    .select('*')
    .eq('device_id', deviceId)
    .order('time', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(request: Request) {
  try {
    const { device_id, goals } = await request.json() as {
      device_id: string;
      goals: { id: string; name: string; time: string; category: string; icon: string }[];
    };

    if (!device_id || !Array.isArray(goals)) {
      return Response.json({ error: 'Missing device_id or goals array' }, { status: 400 });
    }

    const db = getServiceSupabase();

    // Delete existing goals for this device, then insert fresh set
    await db.from('goals').delete().eq('device_id', device_id);

    if (goals.length > 0) {
      const rows = goals.map((g) => ({
        id: g.id,
        device_id,
        name: g.name,
        time: g.time,
        category: g.category,
        icon: g.icon,
      }));

      const { error } = await db.from('goals').insert(rows);
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { device_id, goal_id } = await request.json() as {
      device_id: string;
      goal_id: string;
    };

    if (!device_id || !goal_id) {
      return Response.json({ error: 'Missing device_id or goal_id' }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { error } = await db
      .from('goals')
      .delete()
      .eq('device_id', device_id)
      .eq('id', goal_id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
