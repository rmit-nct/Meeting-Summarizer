// ALL data access for action_items. Scoped by userId. See MODELS.md §3.
import { supabase } from '../../config/supabase.js';
import { TABLE } from './action-item.model.js';

async function findById(id, userId) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// One query, optionally scoped to a meeting (ENDPOINTS.md §4: omit meetingId
// for a cross-meeting view). Count uses the exact head-only form so it costs
// no extra row transfer.
async function list(userId, { meetingId, page, limit }) {
  const offset = (page - 1) * limit;
  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('order_index', { ascending: true })
    .range(offset, offset + limit - 1);
  if (meetingId) query = query.eq('meeting_id', meetingId);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

async function create(userId, { meetingId, content, ownerLabel, dueDate, orderIndex }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      meeting_id: meetingId,
      user_id: userId,
      content,
      owner_label: ownerLabel ?? null,
      due_date: dueDate ?? null,
      order_index: orderIndex ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function update(id, userId, patch) {
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// Additive only — never deletes. This is how "merge, not replace" on
// resummarize is enforced (ENDPOINTS.md §3): re-running summarization can add
// newly-detected tasks but can never wipe a row the user has already ticked
// off. Starts order_index after whatever already exists for the meeting.
async function bulkInsert(userId, meetingId, items, startOrderIndex) {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .insert(items.map((item, i) => ({
      meeting_id: meetingId,
      user_id: userId,
      content: item.content,
      owner_id: item.ownerId ?? null,
      owner_label: item.ownerLabel ?? null,
      due_date: item.dueDate ?? null,
      order_index: startOrderIndex + i,
    })))
    .select();
  if (error) throw error;
  return data;
}

async function countByMeetingId(meetingId, userId) {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('meeting_id', meetingId)
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

// One query for a whole page of meetings instead of N+1 round trips — the
// caller (meeting.service.js#listMeetings) reduces this into a
// meetingId -> count map. See ENDPOINTS.md §2's actionItemCount field.
async function countByMeetingIds(userId, meetingIds) {
  if (meetingIds.length === 0) return {};
  const { data, error } = await supabase
    .from(TABLE)
    .select('meeting_id')
    .eq('user_id', userId)
    .in('meeting_id', meetingIds);
  if (error) throw error;

  const counts = {};
  for (const row of data ?? []) counts[row.meeting_id] = (counts[row.meeting_id] ?? 0) + 1;
  return counts;
}

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
  findById,
  list,
  create,
  update,
  remove,
  bulkInsert,
  countByMeetingId,
  countByMeetingIds,
  maxOrderIndex,
};
