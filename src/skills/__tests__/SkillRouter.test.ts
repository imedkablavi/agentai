import { SkillRouter } from '../SkillRouter';
import { Intent, ConversationContext } from '../../types';

function makeIntent(name: string, overrides: Partial<Intent> = {}): Intent {
  return {
    name,
    confidence: 0.9,
    language: 'ar',
    context_required: false,
    entities: {},
    raw_text: name,
    ...overrides
  };
}

function makeContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    state: 'IDLE',
    awaiting_followup: false,
    conversation_history: [],
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

describe('SkillRouter', () => {
  let router: SkillRouter;

  beforeEach(() => {
    router = new SkillRouter();
  });

  it('routes open_application to ApplicationSkill', () => {
    const intent = makeIntent('open_application', { entities: { application: 'chrome' } });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('ApplicationSkill');
  });

  it('routes close_application to ApplicationSkill', () => {
    const intent = makeIntent('close_application', { entities: { application: 'chrome' } });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('ApplicationSkill');
  });

  it('routes search_web to WebSearchSkill', () => {
    const intent = makeIntent('search_web', { entities: { query: 'weather' } });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('WebSearchSkill');
  });

  it('routes youtube_search to YouTubeSkill', () => {
    const intent = makeIntent('youtube_search', { entities: { query: 'programming' } });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('YouTubeSkill');
  });

  it('routes system_command to SystemSkill', () => {
    const intent = makeIntent('system_command', { entities: { command: 'lock' } });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('SystemSkill');
  });

  it('routes select_item to SelectionSkill', () => {
    const ctx = makeContext({ state: 'AWAITING_SELECTION', awaiting_followup: true, active_skill: 'WebSearchSkill' });
    const intent = makeIntent('select_item', { entities: { index: 1 }, context_required: true });
    const skill = router.route(intent, ctx);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('SelectionSkill');
  });

  it('routes memory_command to MemorySkill', () => {
    const intent = makeIntent('memory_command', { entities: { query: 'I prefer dark mode' } });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('MemorySkill');
  });

  it('routes recall_memory to MemorySkill', () => {
    const intent = makeIntent('recall_memory');
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('MemorySkill');
  });

  it('routes schedule_task to SchedulerSkill', () => {
    const intent = makeIntent('schedule_task', { raw_text: 'كل يوم 08:00 افتح كروم' });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('SchedulerSkill');
  });

  it('routes stop_tasks to SchedulerSkill', () => {
    const intent = makeIntent('stop_tasks');
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('SchedulerSkill');
  });

  it('returns null for low-confidence intent', () => {
    const intent = makeIntent('search_web', { confidence: 0.1, entities: { query: 'test' } });
    const skill = router.route(intent, makeContext());
    expect(skill).toBeNull();
  });

  it('returns null for unknown intent with no context', () => {
    const intent = makeIntent('unknown', { raw_text: 'x' });
    const skill = router.route(intent, makeContext());
    expect(skill).toBeNull();
  });

  it('falls back to WebSearchSkill for unknown intent with long text', () => {
    const intent = makeIntent('unknown', { raw_text: 'something I cannot categorize' });
    const skill = router.route(intent, makeContext());
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('WebSearchSkill');
  });

  it('getAvailableSkills returns all 9 registered skills', () => {
    const skills = router.getAvailableSkills();
    expect(skills.length).toBe(9);
  });

  it('addSkill increases the skill count', () => {
    const before = router.getAvailableSkills().length;
    router.addSkill({
      name: 'TestSkill',
      supported_intents: ['test_intent'],
      validate: () => true,
      execute: async () => ({ action: 'noop', risk_level: 'low', requires_confirmation: false })
    });
    expect(router.getAvailableSkills().length).toBe(before + 1);
  });

  it('removeSkill decreases the skill count', () => {
    const before = router.getAvailableSkills().length;
    router.removeSkill('MemorySkill');
    expect(router.getAvailableSkills().length).toBe(before - 1);
  });
});
