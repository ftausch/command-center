// One-shot: print the auth.users.id for a given email via service-role.
// Usage: node --env-file=.env.local scripts/get-auth-uid.mjs <email>
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/get-auth-uid.mjs <email>');
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error(error.message);
  process.exit(2);
}
const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
if (!u) {
  console.error(`No auth user for ${email}`);
  process.exit(3);
}
console.log(u.id);
