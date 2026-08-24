// SummaryGenerator implementation backed by OpenAI. See AI_INTEGRATION.md §3.
import { openai } from '../../../config/openai.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/logger.js';
import { rateLimited, aiProviderError } from '../../../shared/errors.js';
import { SUMMARY_SYSTEM_PROMPT, buildTranscriptPrompt } from '../summary.prompts.js';

const MAX_ATTEMPTS = 3;

export class OpenAiSummaryGenerator {
  // Returns the raw string the model returned — parsing/validation is the
  // caller's job (summary.service.js), so this class stays a thin adapter
  // over the OpenAI call, retryable independently of JSON-shape retries.
  async generateSummary(segments, { retryHint } = {}) {
    const userContent = retryHint
      ? `${buildTranscriptPrompt(segments)}\n\nYour previous response was invalid: ${retryHint}\nReturn a corrected JSON object matching the required shape exactly.`
      : buildTranscriptPrompt(segments);

    let lastErr;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const completion = await openai.chat.completions.create({
          model: env.OPENAI_SUMMARY_MODEL,
          messages: [
            { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 4096,
        });
        return completion.choices[0]?.message?.content ?? '';
      } catch (err) {
        lastErr = err;
        const status = err?.status ?? err?.response?.status;
        if (status === 429) {
          const retryAfterMs = Number(err?.headers?.['retry-after']) * 1000 || 2000 * attempt;
          if (attempt === MAX_ATTEMPTS) throw rateLimited('Summarization is rate-limited, please retry shortly.', retryAfterMs);
          await sleep(retryAfterMs);
          continue;
        }
        if (status >= 500 || !status) {
          if (attempt === MAX_ATTEMPTS) break;
          await sleep(1000 * attempt);
          continue;
        }
        throw aiProviderError('Summarization service returned an error.');
      }
    }
    logger.error('openai summary call exhausted retries', lastErr);
    throw aiProviderError('Summarization service unavailable, please retry.');
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
