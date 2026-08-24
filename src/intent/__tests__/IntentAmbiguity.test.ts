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

  it('routes narrow explicit system commands through SystemSkill', async () => {
    expect((await routed('shutdown')).skillName).toBe('SystemSkill');
    expect((await routed('أطفئ الجهاز')).skillName).toBe('SystemSkill');
    expect((await routed('bilgisayarı kapat')).skillName).toBe('SystemSkill');
  });

  it('gives specialized file intents precedence over broad open patterns', async () => {
    const english = await routed('open file src/main.ts');
    expect(english.intent.name).toBe('open_file');
    expect(english.skillName).toBe('PersonalAssistantSkill');

    const arabic = await routed('افتح الملف src/main.ts');
    expect(arabic.intent.name).toBe('open_file');
    expect(arabic.skillName).toBe('PersonalAssistantSkill');
  });

  it('extracts Turkish daily schedule task and time deterministically', async () => {
    const engine = new IntentEngine();
    let intent = await engine.classify('her gün saat 09:30 firefox aç', context);
    intent = await engine.extractEntities(intent.raw_text, intent);
    expect(intent.name).toBe('schedule_task');
    expect(intent.entities.at).toBe('09:30');
    expect(intent.entities.query).toBe('firefox aç');
  });
});
