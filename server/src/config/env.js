import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.string().default('development'),
  CLIENT_URL: z.string().min(1),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  SUPABASE_STORAGE_BUCKET: z.string().default('recordings'),
  GROQ_API_KEY: z.string().min(1),
  GROQ_TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3'),
  GROQ_SUMMARY_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_AUDIO_MAX_BYTES: z.coerce.number().default(26214400),
  MAX_UPLOAD_BYTES: z.coerce.number().default(524288000),
  LIVE_SESSION_TTL_HOURS: z.coerce.number().default(4),
  MOCK_AI: z.coerce.boolean().default(false),
});

// Fails loudly at boot rather than mysteriously later. See SETUP.md §3.
// Placeholder values (e.g. "replace-me") pass this check — it only requires
// presence, not a real working credential.
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
