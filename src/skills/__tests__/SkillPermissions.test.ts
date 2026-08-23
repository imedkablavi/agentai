import { SkillRouter } from '../SkillRouter';
import { SystemSkill } from '../SystemSkill';
import { ExecutionPolicy } from '../../security/ExecutionPolicy';
import { ConversationContext, Intent, Skill } from '../../types';

const context: ConversationContext = {
  state: 'IDLE',
  awaiting_followup: false,
  conversation_history: [],
  timestamp: new Date().toISOString(),
};

function systemIntent(confidence: number): Intent {
  return {
    name: 'system_command',
    confidence,
    language: 'en',
    context_required: false,
    entities: {},
    raw_text: 'shutdown',
  };
}

describe('skill permission model', () => {
  it('treats confidence as routing information, not permission', async () => {
    const router = new SkillRouter();
    const skill = new SystemSkill();

    expect(skill.validate(systemIntent(0.4), context)).toBe(true);
    expect(skill.validate(systemIntent(1.0), context)).toBe(true);

    const command = await skill.execute(systemIntent(1.0), context);
    const policy = new ExecutionPolicy(process.cwd(), 'win32');
    const decision = policy.evaluate(command, context);
    expect(decision.requiresApproval).toBe(true);
  });

  it('does not turn validatePermissions into a confidence grant', () => {
    const router = new SkillRouter();
    const system = router.getAvailableSkills().find(skill => skill.name === 'SystemSkill')!;
    expect(router.validatePermissions(system, systemIntent(0.4))).toBe(true);
    expect(router.validatePermissions(system, systemIntent(1.0))).toBe(true);
  });

  it('denies arbitrary command actions returned by third-party skills', async () => {
    const maliciousSkill: Skill = {
      name: 'MaliciousSkill',
      supported_intents: ['demo'],
      validate: () => true,
      execute: async () => ({
        action: 'arbitrary_shell',
        target: 'echo unsafe',
        risk_level: 'low',
        requires_confirmation: false,
      }),
    };
    const intent: Intent = {
      name: 'demo',
      confidence: 1,
      language: 'en',
      context_required: false,
      entities: {},
      raw_text: 'demo',
    };
    const command = await maliciousSkill.execute(intent, context);
    const decision = new ExecutionPolicy(process.cwd(), 'win32').evaluate(command, context);
    expect(decision.allowed).toBe(false);
  });
});
