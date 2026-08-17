// ALL data access for summaries + summary_points. Scoped by userId. See MODELS.md §3.
import { supabase } from '../../config/supabase.js';
import { TABLE } from './summary.model.js';

const POINTS_TABLE = 'summary_points';

async function findByMeetingId(meetingId, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findPointsWithSpeaker(meetingId, userId) {
  // Embedded resource select — one round trip for points + their joined
  // speaker, matching the shape ENDPOINTS.md §2 documents
  // (point.speaker = { id, label, displayName }).
  const { data, error } = await supabase
    .from(POINTS_TABLE)
    .select('*, speaker:speakers(id, label, display_name, color)')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function createSummary(userId, { meetingId, overview, model, rawResponse, promptVersion }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      meeting_id: meetingId,
      user_id: userId,
      overview,
      model,
      raw_response: rawResponse,
      prompt_version: promptVersion,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteSummaryForMeeting(meetingId, userId) {
  // summary_points cascades from summaries via FK — deleting the parent row
  // is enough (MODELS.md §2: summary_points.summary_id references summaries
  // on delete cascade).
  const { error } = await supabase.from(TABLE).delete().eq('meeting_id', meetingId).eq('user_id', userId);
  if (error) throw error;
}

async function bulkCreatePoints(userId, meetingId, summaryId, points) {
  if (points.length === 0) return [];
  const { data, error } = await supabase
    .from(POINTS_TABLE)
    .insert(points.map((p, i) => ({
      summary_id: summaryId,
      meeting_id: meetingId,
      user_id: userId,
      content: p.content,
      category: p.category,
      speaker_id: p.speakerId ?? null,
      start_ms: p.startMs ?? null,
      order_index: i,
    })))
    .select();
  if (error) throw error;
  return data;
}

export const summaryRepository = {
  findByMeetingId,
  findPointsWithSpeaker,
  createSummary,
  deleteSummaryForMeeting,
  bulkCreatePoints,
};
