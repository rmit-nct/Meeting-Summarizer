// ALL data access for speakers. Scoped by userId. See MODELS.md §3.
import { supabase } from '../../config/supabase.js';
import { TABLE } from './speaker.model.js';

async function findByMeetingId(meetingId, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

// Cycled per new speaker so distinct speakers render as visibly distinct
// swatches in SpeakerLegend/TranscriptView without the model ever having to
// think about color. Kept to the two brand accents plus a few tonal
// neighbors, per .claude/TASTE.md's "no rainbow palettes" rule.
const SPEAKER_COLOR_PALETTE = ['#00657a', '#815600', '#555c6a', '#2f6f4f', '#7a4a00', '#5b4b8a'];

// Bulk insert, one row per LLM-inferred speaker. Returns rows in the same
// order they were given so the caller can zip them back against tempIds.
async function bulkCreate(userId, meetingId, speakers) {
  if (speakers.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .insert(speakers.map((s, i) => ({
      meeting_id: meetingId,
      user_id: userId,
      label: s.label,
      color: SPEAKER_COLOR_PALETTE[i % SPEAKER_COLOR_PALETTE.length],
    })))
    .select();
  if (error) throw error;
  return data;
}

async function deleteByMeetingId(meetingId, userId) {
  const { error } = await supabase.from(TABLE).delete().eq('meeting_id', meetingId).eq('user_id', userId);
  if (error) throw error;
}

// Bulk rename — only display_name/color are writable (ENDPOINTS.md §5).
async function bulkRename(userId, updates) {
  const results = await Promise.all(
    updates.map(({ id, displayName, color }) => {
      const patch = {};
      if (displayName !== undefined) patch.display_name = displayName;
      if (color !== undefined) patch.color = color;
      return supabase.from(TABLE).update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle();
    }),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) throw error;
  return results.map((r) => r.data).filter(Boolean);
}

export const speakerRepository = { findByMeetingId, bulkCreate, deleteByMeetingId, bulkRename };
