// ALL data access for action items. Every method takes and scopes on userId. See MODELS.md §3.
import { supabase } from '../../config/supabase.js';
import { TABLE } from './action-item.model.js';

// Same rule as meeting.repository.js: RLS is gone and this client uses the
// service-role key, so .eq('user_id', userId) is the only ownership boundary.

async function insert(userId, fields) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...fields, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Bulk seed from the summary pipeline. One round trip rather than N inserts —
// a long meeting can produce a dozen action items.
async function insertMany(userId, rows) {
  if (!rows.length) return [];
  const payload = rows.map((row) => ({ ...row, user_id: userId }));
  const { data, error } = await supabase.from(TABLE).insert(payload).select();
  if (error) throw error;
  return data ?? [];
}

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

// meetingId omitted = the cross-meeting view ("everything I owe anyone").
async function list(userId, { meetingId, isDone, page, limit }) {
  const offset = (page - 1) * limit;

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (meetingId) query = query.eq('meeting_id', meetingId);
  if (isDone !== undefined) query = query.eq('is_done', isDone);

  // Within a meeting, order_index is the model's ordering and is what the UI
  // shows. Across meetings that number is meaningless, so fall back to recency.
  const query2 = meetingId
    ? query.order('order_index', { ascending: true })
    : query.order('created_at', { ascending: false });

  const { data, error, count } = await query2.range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

// Used by the overview aggregator — no pagination, the detail page shows all
// of one meeting's items.
async function listByMeeting(meetingId, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Highest order_index currently used, so a manual add lands at the bottom
// instead of colliding with an existing row at 0.
async function maxOrderIndex(meetingId, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('order_index')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.order_index ?? -1;
}

export const actionItemRepository = {
  insert,
  insertMany,
  findById,
  update,
  remove,
  list,
  listByMeeting,
  maxOrderIndex,
};