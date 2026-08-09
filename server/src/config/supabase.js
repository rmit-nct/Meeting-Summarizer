import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Secret-key client (new Supabase API key format; equivalent power to the
// legacy service_role key). Bypasses RLS — every repository call MUST scope
// by userId. See MODELS.md §3.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
