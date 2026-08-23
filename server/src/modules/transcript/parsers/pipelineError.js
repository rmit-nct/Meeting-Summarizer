// Typed failure carrying the human-readable message that reaches
// meetings.error_message. Shared by every parser strategy and by
// transcript.service.js. See AI_INTEGRATION.md §6.
export class PipelineError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
