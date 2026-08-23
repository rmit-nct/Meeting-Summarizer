// ALL data access for transcripts. Scoped by userId. See MODELS.md §3.
import { supabase } from '../../config/supabase.js';
import { TABLE } from './transcript.model.js';

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

// `sourceKind` (which parser strategy produced this transcript — see
// transcript/parsers/) is intentionally not persisted here: the `transcripts`
// table has no `source_kind` column in the current migrations, and adding
// one isn't this module's call to make (Supabase schema ownership is
// separate from this work — see FROM_MEETING_TO_JSON_PLAN.md §3 for the
// column this would need once that migration exists).
async function create(userId, { meetingId, fullText, segments, language, model, wordCount }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      meeting_id: meetingId,
      user_id: userId,
      full_text: fullText,
      segments,
      language,
      model,
      word_count: wordCount,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const transcriptRepository = { findByMeetingId, create };
