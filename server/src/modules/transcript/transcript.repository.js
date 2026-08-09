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
