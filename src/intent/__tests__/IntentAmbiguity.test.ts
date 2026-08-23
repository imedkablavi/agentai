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
    expect((await routed('do it')).skillName).toBeNull();
    expect((await routed('نفذها')).skillName).toBeNull();
  });

  it('does not route application commands without an allowlisted application', async () => {
    expect((await routed('open it')).skillName).toBeNull();
    expect((await routed('افتح هذا')).skillName).toBeNull();
  });

  it('rejects compound text that embeds a system verb plus another operation', async () => {
    expect((await routed('shutdown and delete everything')).skillName).toBeNull();
    expect((await routed('أطفئ الجهاز واحذف الملفات')).skillName).toBeNull();
    expect((await routed('bilgisayarı kapat ve dosyaları sil')).skillName).toBeNull();
  });

  it('still recognizes narrow explicit system commands semantically', async () => {
    expect((await routed('shutdown')).skillName).toBe('SystemSkill');
    expect((await routed('أطفئ الجهاز')).skillName).toBe('SystemSkill');
    expect((await routed('bilgisayarı kapat')).skillName).toBe('SystemSkill');
  });
});
