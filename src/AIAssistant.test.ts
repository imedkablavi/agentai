import { AIAssistant } from './AIAssistant';

describe('AIAssistant confirmation behavior', () => {
  it('returns clear message when confirm_action arrives without pending confirmation', async () => {
    const assistant = new AIAssistant();
    (assistant as any).llm = { infer: jest.fn().mockResolvedValue(null) };
    (assistant as any).intentEngine.classify = jest.fn().mockResolvedValue({
      name: 'confirm_action',
      confidence: 0.95,
      language: 'en',
      context_required: true,
      entities: {},
      raw_text: 'yes'
    });
    (assistant as any).intentEngine.extractEntities = jest.fn(async (_: string, intent: any) => intent);
    (assistant as any).intentEngine.calculateConfidence = jest.fn(() => 0.95);
    const res = await assistant.processInput('yes');
    (assistant as any).taskRunner.stop();
    expect(res.response.toLowerCase()).toContain('no pending action');
  });
});
