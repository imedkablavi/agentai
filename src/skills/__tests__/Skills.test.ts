import { MemorySkill } from '../MemorySkill';
import { SchedulerSkill } from '../SchedulerSkill';
import { WebSearchSkill } from '../WebSearchSkill';
import { YouTubeSkill } from '../YouTubeSkill';
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

describe('MemorySkill', () => {
  const skill = new MemorySkill();

  it('supports memory_command and recall_memory intents', () => {
    expect(skill.supported_intents).toContain('memory_command');
    expect(skill.supported_intents).toContain('recall_memory');
  });

  it('validates memory_command when query is present', () => {
    const intent = makeIntent('memory_command', { entities: { query: 'I prefer dark mode' } });
    expect(skill.validate(intent, makeContext())).toBe(true);
  });

  it('rejects memory_command when query is missing', () => {
    const intent = makeIntent('memory_command', { entities: {} });
    expect(skill.validate(intent, makeContext())).toBe(false);
  });

  it('validates recall_memory without query', () => {
    const intent = makeIntent('recall_memory');
    expect(skill.validate(intent, makeContext())).toBe(true);
  });

  it('executes memory_command as store_memory action', async () => {
    const intent = makeIntent('memory_command', { entities: { query: 'dark mode preferred' } });
    const cmd = await skill.execute(intent, makeContext());
    expect(cmd.action).toBe('store_memory');
    expect(cmd.params?.content).toBe('dark mode preferred');
  });

  it('executes recall_memory as recall_memory action', async () => {
    const intent = makeIntent('recall_memory');
    const cmd = await skill.execute(intent, makeContext());
    expect(cmd.action).toBe('recall_memory');
    expect(cmd.risk_level).toBe('low');
  });
});

describe('SchedulerSkill', () => {
  const skill = new SchedulerSkill();

  it('supports schedule_task and stop_tasks intents', () => {
    expect(skill.supported_intents).toContain('schedule_task');
    expect(skill.supported_intents).toContain('stop_tasks');
  });

  it('validates stop_tasks unconditionally', () => {
    const intent = makeIntent('stop_tasks');
    expect(skill.validate(intent, makeContext())).toBe(true);
  });

  it('validates schedule_task when raw_text has content', () => {
    const intent = makeIntent('schedule_task', { raw_text: 'كل يوم 08:00 افتح كروم' });
    expect(skill.validate(intent, makeContext())).toBe(true);
  });

  it('executes stop_tasks command', async () => {
    const intent = makeIntent('stop_tasks');
    const cmd = await skill.execute(intent, makeContext());
    expect(cmd.action).toBe('stop_tasks');
    expect(cmd.risk_level).toBe('low');
    expect(cmd.requires_confirmation).toBe(false);
  });

  it('executes schedule_task with default at=08:00', async () => {
    const intent = makeIntent('schedule_task', { raw_text: 'جدول مهمة' });
    const cmd = await skill.execute(intent, makeContext());
    expect(cmd.action).toBe('schedule_task');
    expect(cmd.params?.at).toBe('08:00');
  });

  it('executes schedule_task with custom at time from entities', async () => {
    const intent = makeIntent('schedule_task', {
      raw_text: 'كل يوم 09:30 افتح كروم',
      entities: { at: '09:30' }
    });
    const cmd = await skill.execute(intent, makeContext());
    expect(cmd.action).toBe('schedule_task');
    expect(cmd.params?.at).toBe('09:30');
  });
});

describe('WebSearchSkill', () => {
  const skill = new WebSearchSkill();

  it('supports search_web intent', () => {
    expect(skill.supported_intents).toContain('search_web');
  });

  it('validates when query is present', () => {
    const intent = makeIntent('search_web', { entities: { query: 'weather' } });
    expect(skill.validate(intent, makeContext())).toBe(true);
  });

  it('rejects when query is missing', () => {
    const intent = makeIntent('search_web', { entities: {} });
    expect(skill.validate(intent, makeContext())).toBe(false);
  });

  it('executes as web_search action', async () => {
    const intent = makeIntent('search_web', { entities: { query: 'weather' } });
    const cmd = await skill.execute(intent, makeContext());
    expect(cmd.action).toBe('web_search');
    expect(cmd.params?.query).toBe('weather');
    expect(cmd.risk_level).toBe('low');
  });
});

describe('YouTubeSkill', () => {
  const skill = new YouTubeSkill();

  it('supports youtube_search intent', () => {
    expect(skill.supported_intents).toContain('youtube_search');
  });

  it('validates when query is present', () => {
    const intent = makeIntent('youtube_search', { entities: { query: 'programming tutorial' } });
    expect(skill.validate(intent, makeContext())).toBe(true);
  });

  it('rejects when query is missing', () => {
    const intent = makeIntent('youtube_search', { entities: {} });
    expect(skill.validate(intent, makeContext())).toBe(false);
  });

  it('executes as youtube_search action', async () => {
    const intent = makeIntent('youtube_search', { entities: { query: 'programming tutorial' } });
    const cmd = await skill.execute(intent, makeContext());
    expect(cmd.action).toBe('youtube_search');
    expect(cmd.params?.query).toBe('programming tutorial');
    expect(cmd.risk_level).toBe('low');
  });
});
