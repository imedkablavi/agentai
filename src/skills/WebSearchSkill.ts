import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class WebSearchSkill implements Skill {
  name = 'WebSearchSkill';
  supported_intents = ['search_web'];

  validate(intent: Intent, context: ConversationContext): boolean {
    return !!intent.entities.query && intent.entities.query.length > 0;
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    const query = intent.entities.query!;
    return {
      action: 'web_search',
      params: { query },
      risk_level: 'low',
      requires_confirmation: false
    };
  }
}
