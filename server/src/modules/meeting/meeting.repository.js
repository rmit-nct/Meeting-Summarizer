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

async function create(userId, { title, description, meetingDate }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      title,
      description: description ?? null,
      meeting_date: meetingDate ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

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

async function remove(id, userId) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// One round trip for both the page and the total: `count: 'exact'` makes
// PostgREST return the unfiltered-by-range count in the Content-Range header.
//
// INTERIM: title-only search. The richer version of this (search_meetings /
// count_meetings rpc, matching transcript full_text and summary overview too
// per ENDPOINTS.md §2) needs those functions defined in a migration first —
// they don't exist in server/supabase/migrations/ yet, so this stays on a
// direct table query until that lands. The API shape does not change when it does.
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
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export const meetingRepository = { findById, create, update, remove, list };
