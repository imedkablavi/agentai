import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class YouTubeSkill implements Skill {
  name = 'YouTubeSkill';
  supported_intents = ['youtube_search'];

  validate(intent: Intent, _context: ConversationContext): boolean {
    return !!intent.entities.query && intent.entities.query.length > 0;
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    const query = intent.entities.query!;
    return {
      action: 'youtube_search',
      params: { query },
      risk_level: 'low',
      requires_confirmation: false
    };
  }
}
