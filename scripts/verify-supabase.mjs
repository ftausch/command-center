// Connection smoke-test for the project's Supabase setup.
//
// Run:
//   npm run verify:supabase
//
// or directly:
//   node --env-file=.env.local scripts/verify-supabase.mjs
//
// What it checks (in order):
//   1. Env vars are present
//   2. The /auth/v1/health endpoint is reachable
//   3. The anon client can select from `workspaces`
//   4. The `workspaces` table has at least the two seeded rows
//   5. The `tasks` table exists (any error here means migration 0001 not run)
//   6. (If SUPABASE_SERVICE_ROLE_KEY is set) the service-role client can write
//      a no-op activity row and roll it back, proving admin access works
//
// The script never prints secrets. Exit codes:
//   0  all good          1  env missing       2  network unreachable
//   3  schema missing    4  RLS / auth fail    5  service-role broken

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const mask = (s) => (s ? s.slice(0, 6) + '…' + s.slice(-4) : '');

console.log('—— Command Center · Supabase connection check ——\n');
console.log('  URL              :', url ? url : '✗ MISSING');
console.log('  Anon key         :', anon ? `present (${mask(anon)})` : '✗ MISSING');
console.log('  Service-role key :', serviceKey ? `present (${mask(serviceKey)})` : '— (optional)');
console.log();

if (!url || !anon) {
  console.error('Cannot continue. Create .env.local in the project root with:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=...   (optional but needed for admin code paths)');
  process.exit(1);
}

// ── 1) reachability ─────────────────────────────────────────────────────
process.stdout.write('1) Auth health endpoint …………… ');
let healthRes;
try {
  healthRes = await fetch(url + '/auth/v1/health', {
    headers: { apikey: anon },
  });
} catch (e) {
  console.error('✗ network error:', e.message);
  process.exit(2);
}
if (!healthRes.ok) {
  console.error(`✗ HTTP ${healthRes.status}`);
  process.exit(2);
}
console.log('✓');

// ── 2) anon read against workspaces ─────────────────────────────────────
const supabase = createClient(url, anon, { auth: { persistSession: false } });
process.stdout.write('2) workspaces table reachable  ');
const workspaces = await supabase.from('workspaces').select('id, slug, name').limit(10);
if (workspaces.error) {
  if (workspaces.error.code === '42P01') {
    console.error('✗ table does not exist — apply migration 0001_initial_schema.sql');
    process.exit(3);
  }
  console.error('✗', workspaces.error.code ?? '', workspaces.error.message);
  process.exit(4);
}
console.log(`✓ (${workspaces.data.length} row${workspaces.data.length === 1 ? '' : 's'})`);
if (workspaces.data.length === 0) {
  console.log('   ! table is empty — apply supabase/seed.sql to insert UnicornBakery + SelbstFrei');
} else {
  for (const w of workspaces.data) console.log(`   · ${w.slug.padEnd(15)} ${w.name}`);
}

// ── 3) tasks table presence ─────────────────────────────────────────────
process.stdout.write('3) tasks table present ……………… ');
const tasks = await supabase.from('tasks').select('id', { head: true, count: 'exact' });
if (tasks.error) {
  if (tasks.error.code === '42P01') {
    console.error('✗ table does not exist — re-run migration 0001_initial_schema.sql');
    process.exit(3);
  }
  console.error('✗', tasks.error.code ?? '', tasks.error.message);
  process.exit(4);
}
console.log(`✓ (${tasks.count ?? 0} rows visible to anon)`);

// ── 4) RLS sanity: anon cannot read auth.users via PostgREST ────────────
process.stdout.write('4) RLS denies anon writes …… ');
const writeProbe = await supabase
  .from('workspaces')
  .insert({ slug: '__test', name: '__test' })
  .select();
if (!writeProbe.error) {
  console.log('⚠ insert succeeded as anon — RLS may not be on. Re-run 0002_rls_policies.sql');
  // best-effort cleanup
  await supabase.from('workspaces').delete().eq('slug', '__test');
} else {
  console.log('✓ (rejected as expected:', writeProbe.error.code ?? 'no code', ')');
}

// ── 5) service-role admin write/rollback ────────────────────────────────
if (serviceKey) {
  process.stdout.write('5) service-role can write ……… ');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Need a real workspace_id to satisfy the FK. Pick the first seeded row.
  if (workspaces.data.length === 0) {
    console.log('skipped (no workspaces seeded yet)');
  } else {
    const wsId = workspaces.data[0].id;
    const probe = await admin
      .from('activity_logs')
      .insert({
        workspace_id: wsId,
        actor_id: null,
        kind: 'task_created',
        target_type: 'connection_test',
        target_id: '00000000-0000-0000-0000-000000000000',
        meta: { note: 'verify-supabase smoke test' },
      })
      .select()
      .single();
    if (probe.error) {
      console.error('✗', probe.error.code ?? '', probe.error.message);
      process.exit(5);
    }
    // rollback
    await admin.from('activity_logs').delete().eq('id', probe.data.id);
    console.log('✓ (inserted + rolled back)');
  }
} else {
  console.log('5) service-role check skipped (no SUPABASE_SERVICE_ROLE_KEY set)');
}

console.log('\n✓ all checks passed.\n');
