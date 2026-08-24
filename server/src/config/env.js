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
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default('whisper-1'),
  OPENAI_SUMMARY_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_AUDIO_MAX_BYTES: z.coerce.number().default(26214400),
  MAX_UPLOAD_BYTES: z.coerce.number().default(524288000),
  LIVE_SESSION_TTL_HOURS: z.coerce.number().default(4),
  // z.coerce.boolean() is `Boolean(value)` under the hood — any non-empty
  // string (including the literal "false") coerces to `true`. This is a
  // string flag, not a number/date, so it needs an explicit string compare.
  MOCK_AI: z.string().optional().transform((v) => v === 'true'),
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
