import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class ApplicationSkill implements Skill {
  name = 'ApplicationSkill';
  supported_intents = ['open_application', 'close_application'];

  private readonly applicationMap = new Set([
    'chrome', 'firefox', 'word', 'excel', 'notepad', 'calculator', 'spotify', 'discord', 'telegram',
  ]);

  validate(intent: Intent, _context: ConversationContext): boolean {
    const appName = intent.entities.application?.toLowerCase();
    return Boolean(appName && this.applicationMap.has(appName));
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    const appName = intent.entities.application!.toLowerCase();
    if (intent.name === 'open_application') {
      return { action: 'open_application', target: appName, risk_level: 'low', requires_confirmation: false };
    }
    if (intent.name === 'close_application') {
      return { action: 'close_application', target: appName, risk_level: 'medium', requires_confirmation: true };
    }
    return { action: 'unknown', risk_level: 'high', requires_confirmation: true };
  }
}
