// SummaryGeneratorFactory — config-driven selection, never a hardcoded model
// name in business logic. See OOP_PATTERNS_GUIDE.md §2.
//
// Reconciliation with the guide (recorded in full in
// FROM_MEETING_TO_JSON_PLAN.md §1): the guide's GptOssAdapter/GptLunaAdapter
// names a second LLM provider that does not exist in this codebase — the
// project runs on OpenAI, and OPENAI_SUMMARY_MODEL is the env-driven model
// switch (AI_INTEGRATION.md §5). The pattern the guide actually cares about —
// an interface both implementations share, selected by env config, never a
// hardcoded model string in the service — is preserved exactly by swapping
// dev/prod for MOCK_AI/real, which is the swap this codebase genuinely has.
import { env } from '../../../config/env.js';
import { OpenAiSummaryGenerator } from './openAiSummaryGenerator.js';
import { MockSummaryGenerator } from './mockSummaryGenerator.js';

export const SummaryGeneratorFactory = {
  create() {
    return env.MOCK_AI ? new MockSummaryGenerator() : new OpenAiSummaryGenerator();
  },
};
