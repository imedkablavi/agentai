import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class DeveloperSkill implements Skill {
  name = 'DeveloperSkill';
  supported_intents = ['dev_inspect', 'dev_fix', 'dev_test'];

  validate(intent: Intent, _context: ConversationContext): boolean {
    if (!this.supported_intents.includes(intent.name)) return false;
    if (intent.name === 'dev_test') return true;
    return Boolean(intent.entities.file_path || intent.entities.query);
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    const targetFile = intent.entities.file_path || intent.entities.query || '';

    if (intent.name === 'dev_inspect') {
      return { action: 'dev_inspect', target: targetFile, risk_level: 'low', requires_confirmation: false };
    }
    if (intent.name === 'dev_test') {
      return { action: 'dev_test', target: targetFile || undefined, risk_level: 'medium', requires_confirmation: true };
    }
    if (intent.name === 'dev_fix') {
      // This stage generates and validates a preview. Applying the staged patch is
      // a separate centrally-authorized transaction after exact user approval.
      return { action: 'dev_fix', target: targetFile, risk_level: 'medium', requires_confirmation: false };
    }

    return { action: 'unknown', risk_level: 'high', requires_confirmation: true };
  }
}
