import OpenAI from 'openai';
import { env } from './env.js';

// See AI_INTEGRATION.md. When MOCK_AI=true, this resolves to null and the
// transcript/summary generators use their fixture-backed stubs instead, so
// the pipeline can be developed and demoed without hitting the OpenAI API.
export const openai = env.MOCK_AI ? null : new OpenAI({ apiKey: env.OPENAI_API_KEY });
