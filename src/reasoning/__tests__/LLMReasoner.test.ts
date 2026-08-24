import { normalizeReasonerPayload } from '../LLMReasoner';

describe('normalizeReasonerPayload', () => {
  it('does not allow an LLM to invent an executable capability', () => {
    const intent = normalizeReasonerPayload({
      intent_name: 'arbitrary_shell',
      confidence: 1,
      language: 'en',
      entities: { query: 'rm -rf /' },
    }, 'do something');

    expect(intent).not.toBeNull();
    expect(intent?.name).toBe('unknown');
    expect(intent?.confidence).toBe(1);
  });

  it('clamps confidence and filters malformed entity values', () => {
    const intent = normalizeReasonerPayload({
      intent_name: 'open_application',
      confidence: 42,
      language: 'en',
      entities: {
        application: 'Firefox',
        index: -4,
        time: '99:99',
      },
    }, 'open firefox');

    expect(intent?.confidence).toBe(1);
    expect(intent?.entities.application).toBe('firefox');
    expect(intent?.entities.index).toBeUndefined();
    expect(intent?.entities.time).toBeUndefined();
  });

  it('rejects non-object model payloads', () => {
    expect(normalizeReasonerPayload(null, 'x')).toBeNull();
    expect(normalizeReasonerPayload('not-json', 'x')).toBeNull();
  });
});
