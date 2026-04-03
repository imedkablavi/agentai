import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class SelectionSkill implements Skill {
  name = 'SelectionSkill';
  supported_intents = ['select_item'];

  validate(intent: Intent, context: ConversationContext): boolean {
    // Must have an index and context from previous action
    return !!intent.entities.index && 
           !!(context.active_skill || context.awaiting_followup);
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    const selectedIndex = intent.entities.index!;
    return {
      action: 'select_item',
      params: { index: selectedIndex },
      risk_level: 'low',
      requires_confirmation: false
    };
  }

  // Stateless skill: no direct selection handling or memory
}
