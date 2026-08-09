import Groq from 'groq-sdk';
import { env } from './env.js';

// See AI_INTEGRATION.md. When MOCK_AI=true, this should resolve to a
// fixture-backed stub instead, so the pipeline can be developed and demoed
// without hitting the Groq API. That swap is a TODO for transcript/summary.
export const groq = env.MOCK_AI ? null : new Groq({ apiKey: env.GROQ_API_KEY });
