import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class MemorySkill implements Skill {
  name = 'MemorySkill';
  supported_intents = ['memory_command'];

  validate(intent: Intent, _context: ConversationContext): boolean {
    return !!intent.entities.query && intent.entities.query.length > 0;
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    const memoryContent = intent.entities.query!;
    return {
      action: 'store_memory',
      params: { content: memoryContent },
      risk_level: 'low',
      requires_confirmation: false
    };
  }

  // Stateless: no memory typing here; executor/MemMgr handles rules
}
