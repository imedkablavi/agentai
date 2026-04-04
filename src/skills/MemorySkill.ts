import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class MemorySkill implements Skill {
  name = 'MemorySkill';
  supported_intents = ['memory_command', 'recall_memory'];

  validate(intent: Intent, _context: ConversationContext): boolean {
    if (intent.name === 'recall_memory') return true;
    return !!intent.entities.query && intent.entities.query.length > 0;
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    if (intent.name === 'recall_memory') {
      return {
        action: 'recall_memory',
        params: {},
        risk_level: 'low',
        requires_confirmation: false
      };
    }
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
