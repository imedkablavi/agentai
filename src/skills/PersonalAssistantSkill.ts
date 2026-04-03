import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class PersonalAssistantSkill implements Skill {
  name = 'PersonalAssistantSkill';
  supported_intents = ['open_file', 'read_file', 'summarize_logs'];

  validate(intent: Intent): boolean {
    if (intent.name === 'summarize_logs') return true;
    return Boolean(intent.entities.file_path || intent.entities.query);
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    if (intent.name === 'open_file') {
      return {
        action: 'open_file',
        target: intent.entities.file_path || intent.entities.query,
        risk_level: 'low',
        requires_confirmation: false
      };
    }

    if (intent.name === 'read_file') {
      return {
        action: 'read_file',
        target: intent.entities.file_path || intent.entities.query,
        risk_level: 'low',
        requires_confirmation: false
      };
    }

    return {
      action: 'summarize_logs',
      target: intent.entities.file_path || intent.entities.query,
      risk_level: 'low',
      requires_confirmation: false
    };
  }
}
