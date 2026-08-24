// SummaryGenerator implementation used when MOCK_AI=true — lets the whole
// summarization + persistence path be exercised offline, and is the fallback
// that saves a demo if OpenAI rate-limits mid-recording. See AI_INTEGRATION.md §7.
// Same interface as OpenAiSummaryGenerator: generateSummary(segments) -> raw
// JSON string, so summary.service.js never branches on which one it holds.
export class MockSummaryGenerator {
  async generateSummary(segments) {
    const firstText = segments[0]?.text ?? 'The meeting covered a few topics.';
    const response = {
      schemaVersion: '1.0',
      language: 'en',
      overview: 'Mock summary generated because MOCK_AI is enabled. The team discussed the deadline and next steps.',
      speakers: [
        { tempId: 'spk_1', label: 'Speaker 1', nameGuess: null, evidence: 'First to speak.' },
      ],
      points: [
        {
          tempId: 'pt_1',
          content: firstText.slice(0, 200),
          category: 'decision',
          speakerTempId: 'spk_1',
          startMs: Math.round((segments[0]?.start ?? 0) * 1000),
        },
      ],
      actionItems: [
        {
          tempId: 'ai_1',
          content: 'Redo the Gantt chart with the new deadline.',
          ownerTempId: 'spk_1',
          ownerLabelFallback: null,
          dueDate: null,
          sourcePointTempId: 'pt_1',
        },
      ],
    };
    return JSON.stringify(response);
  }
}
