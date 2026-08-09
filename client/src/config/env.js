import { z } from 'zod';

const schema = z.object({
  VITE_API_URL: z.string().min(1),
  VITE_SOCKET_URL: z.string().min(1),
  VITE_SUPABASE_URL: z.string().min(1),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
}

export const env = parsed.success ? parsed.data : import.meta.env;
