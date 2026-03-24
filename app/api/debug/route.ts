import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/debug — Diagnóstico completo de Supabase, env vars y push subscriptions.
 * Visitar en el navegador para ver qué está fallando.
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  // 1. Verificar que las env vars existen
  checks.env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `✅ ${process.env.NEXT_PUBLIC_SUPABASE_URL}`
      : '❌ NO DEFINIDA',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `✅ ...${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(-20)}`
      : '❌ NO DEFINIDA',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `✅ ...${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-20)}`
      : '❌ NO DEFINIDA',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ? `✅ ...${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.slice(-20)}`
      : '❌ NO DEFINIDA',
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? '✅ SET' : '❌ NO DEFINIDA',
    CRON_SECRET: process.env.CRON_SECRET ? '✅ SET' : '❌ NO DEFINIDA',
  };

  // 2. Intentar crear cliente Supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    checks.supabase = '❌ No se puede crear cliente — faltan env vars';
    return Response.json(checks, { headers: { 'Cache-Control': 'no-store' } });
  }

  const db = createClient(url, serviceKey);

  // 3. Probar SELECT en push_subscriptions
  try {
    const { data, error, status, statusText } = await db
      .from('push_subscriptions')
      .select('*')
      .limit(10);

    checks.select_push_subscriptions = error
      ? { status: '❌ ERROR', code: error.code, message: error.message, hint: error.hint, details: error.details, httpStatus: status, httpStatusText: statusText }
      : { status: '✅ OK', count: data?.length ?? 0, rows: data };
  } catch (err) {
    checks.select_push_subscriptions = { status: '❌ EXCEPTION', error: String(err) };
  }

  // 4. Probar INSERT de prueba en push_subscriptions
  const testEndpoint = `https://test.push.service/debug-${Date.now()}`;
  try {
    const { data, error, status, statusText } = await db
      .from('push_subscriptions')
      .insert({
        endpoint: testEndpoint,
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
        goals: [{ id: 'test', name: 'Test Goal', time: '12:00', icon: '🧪' }],
        timezone: 'UTC',
        device_id: 'debug-test',
        updated_at: new Date().toISOString(),
      })
      .select();

    checks.insert_test = error
      ? { status: '❌ ERROR', code: error.code, message: error.message, hint: error.hint, details: error.details, httpStatus: status, httpStatusText: statusText }
      : { status: '✅ OK', inserted: data };
  } catch (err) {
    checks.insert_test = { status: '❌ EXCEPTION', error: String(err) };
  }

  // 5. Limpiar la fila de prueba
  try {
    await db.from('push_subscriptions').delete().eq('endpoint', testEndpoint);
    checks.cleanup = '✅ Fila de prueba eliminada';
  } catch (err) {
    checks.cleanup = { status: '❌ EXCEPTION', error: String(err) };
  }

  // 6. Probar SELECT en goals
  try {
    const { data, error } = await db.from('goals').select('*').limit(5);
    checks.select_goals = error
      ? { status: '❌ ERROR', code: error.code, message: error.message, hint: error.hint }
      : { status: '✅ OK', count: data?.length ?? 0 };
  } catch (err) {
    checks.select_goals = { status: '❌ EXCEPTION', error: String(err) };
  }

  // 7. Probar SELECT en completions
  try {
    const { data, error } = await db.from('completions').select('*').limit(5);
    checks.select_completions = error
      ? { status: '❌ ERROR', code: error.code, message: error.message, hint: error.hint }
      : { status: '✅ OK', count: data?.length ?? 0 };
  } catch (err) {
    checks.select_completions = { status: '❌ EXCEPTION', error: String(err) };
  }

  // 8. Server time
  const now = new Date();
  checks.server_time = {
    utc: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return Response.json(checks, { headers: { 'Cache-Control': 'no-store' } });
}
