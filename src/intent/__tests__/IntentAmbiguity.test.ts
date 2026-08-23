import { IntentEngine } from '../IntentEngine';
import { SkillRouter } from '../../skills/SkillRouter';
import { ConversationContext, Intent } from '../../types';

const context: ConversationContext = {
  state: 'IDLE',
  awaiting_followup: false,
  conversation_history: [],
  timestamp: new Date().toISOString(),
};

async function routed(text: string): Promise<{ intent: Intent; skillName: string | null }> {
  const engine = new IntentEngine();
  const router = new SkillRouter();
  let intent = await engine.classify(text, context);
  intent = await engine.extractEntities(text, intent);
  intent.confidence = engine.calculateConfidence(intent, context);
  const skill = router.route(intent, context);
  return { intent, skillName: skill?.name || null };
}

describe('prompt and intent ambiguity', () => {
  it('does not route pronoun-only execution requests', async () => {
    const result = await routed('do it');
    expect(result.skillName).toBeNull();
  });

  it('does not route application commands without an allowlisted application', async () => {
    expect((await routed('open it')).skillName).toBeNull();
    expect((await routed('افتح هذا')).skillName).toBeNull();
  });

  it('rejects compound text that embeds a destructive system verb', async () => {
    const result = await routed('shutdown and delete everything');
    expect(result.skillName).toBeNull();
  });

  it('still recognizes a narrow explicit system command semantically', async () => {
    const result = await routed('shutdown');
    expect(result.skillName).toBe('SystemSkill');
  });
});
