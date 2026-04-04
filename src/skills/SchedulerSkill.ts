import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class SchedulerSkill implements Skill {
  name = 'SchedulerSkill';
  supported_intents = ['schedule_task', 'stop_tasks'];

  validate(intent: Intent, _context: ConversationContext): boolean {
    if (intent.name === 'stop_tasks') return true;
    // schedule_task needs at least some content to schedule
    return intent.raw_text.length > 3;
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    if (intent.name === 'stop_tasks') {
      return {
        action: 'stop_tasks',
        params: {},
        risk_level: 'low',
        requires_confirmation: false
      };
    }

    const at: string = ((intent.entities as any).at as string) || '08:00';
    return {
      action: 'schedule_task',
      params: { at, intent_snapshot: intent },
      risk_level: 'low',
      requires_confirmation: false
    };
  }
}
