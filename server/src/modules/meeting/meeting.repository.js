// ALL data access for meetings. Every method takes and scopes on userId. See MODELS.md §3, §5 (search_meetings rpc).
import { supabase } from '../../config/supabase.js';
import { TABLE } from './meeting.model.js';

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

// Backed by the search_meetings/count_meetings rpc functions (MODELS.md §5) so
// the keyword/date query lives in one place in a migration, not scattered
// template strings. Both calls run in parallel — independent reads, no
// reason to serialize them.
//
// Neither function takes a `status` param (MODELS.md §5) — when `status` is
// given, this runs a direct table query instead, which only means keyword
// search doesn't reach into transcript/summary content on a status-filtered
// page (title-only). Folding `status` into the rpc functions is the cleaner
// fix; that's a migration change, not something to improvise here.
async function list(userId, { q, from, to, status, page, limit }) {
  const offset = (page - 1) * limit;
  if (status) return listByStatus(userId, { q, from, to, status, offset, limit });

  const params = { p_user_id: userId, p_q: q ?? null, p_from: from ?? null, p_to: to ?? null };
  const [rowsRes, countRes] = await Promise.all([
    supabase.rpc('search_meetings', { ...params, p_limit: limit, p_offset: offset }),
    supabase.rpc('count_meetings', params),
  ]);
  if (rowsRes.error) throw rowsRes.error;
  if (countRes.error) throw countRes.error;

  return { rows: rowsRes.data ?? [], total: countRes.data ?? 0 };
}

async function listByStatus(userId, { q, from, to, status, offset, limit }) {
  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (q) query = query.ilike('title', `%${q}%`);
  if (from) query = query.gte('meeting_date', from);
  if (to) query = query.lte('meeting_date', to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export const meetingRepository = { findById, create, update, remove, list };
