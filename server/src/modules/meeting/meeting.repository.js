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

export const meetingRepository = { findById, update };
