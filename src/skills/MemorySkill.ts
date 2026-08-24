import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class MemorySkill implements Skill {
  name = 'MemorySkill';
  supported_intents = ['memory_command'];

  validate(intent: Intent, _context: ConversationContext): boolean {
    return Boolean(intent.entities.query && intent.entities.query.trim().length > 0);
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    return {
      action: 'store_memory',
      params: { content: intent.entities.query!.trim() },
      risk_level: 'medium',
      requires_confirmation: true,
    };
  }
}
