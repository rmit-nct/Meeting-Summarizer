import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client. Bypasses RLS — every repository call MUST scope by
// userId. See MODELS.md §3.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
