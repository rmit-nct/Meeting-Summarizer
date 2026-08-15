// ALL data access for meetings. Every method takes and scopes on userId. See MODELS.md §3, §5 (search_meetings rpc).
import { supabase } from '../../config/supabase.js';
import { TABLE } from './meeting.model.js';

// -----------------------------------------------------------------------------
// NOTE ON userId
//
// RLS was dropped (brainstorm §10) and config/supabase.js uses the service-role
// key, which bypasses every policy. That makes the .eq('user_id', userId) below
// the ONLY thing preventing user B from reading user A's meetings.
//
// A method here without a userId parameter is a security bug, not a shortcut.
// -----------------------------------------------------------------------------

async function insert(userId, fields) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...fields, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Unchanged from feat/transcript-api — do not reformat, it keeps the merge clean.
async function findById(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Unchanged from feat/transcript-api.
async function update(id, userId, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Returns the deleted row, or null if it did not exist / was not theirs — so
// the service can tell "deleted" from "never yours" and return 404 for both.
async function remove(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// One round trip for both the page and the total: `count: 'exact'` makes
// PostgREST return the unfiltered-by-range count in the Content-Range header.
async function list(userId, { q, status, from, to, page, limit }) {
  const offset = (page - 1) * limit;

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (status) query = query.eq('status', status);
  // meeting_date is a date column and may be null on drafts; those correctly
  // drop out of a filtered range.
  if (from) query = query.gte('meeting_date', from);
  if (to) query = query.lte('meeting_date', to);

  // INTERIM: title-only search. Phase 6 / card #28 replaces this with the
  // search_meetings RPC so `q` also matches transcript full_text and summary
  // overview. The API shape does not change when it does.
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export const meetingRepository = { insert, findById, update, remove, list };