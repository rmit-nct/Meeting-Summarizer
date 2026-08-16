import { z } from 'zod';
export const registerSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(8).max(128), name: z.string().trim().min(1).max(100) });
export const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(128) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
