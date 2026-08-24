import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';

export class SystemSkill implements Skill {
  name = 'SystemSkill';
  supported_intents = ['system_command'];

  validate(intent: Intent, _context: ConversationContext): boolean {
    // Validation establishes semantic intent only. ExecutionPolicy decides whether
    // the resulting operation is allowed and whether explicit approval is needed.
    return intent.name === 'system_command' && this.parseSystemCommand(intent.raw_text) !== null;
  }

  async execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand> {
    const command = this.parseSystemCommand(intent.raw_text);
    if (!command) return { action: 'unknown', risk_level: 'high', requires_confirmation: true };
    const actionMap: Record<string, string> = {
      shutdown: 'system_shutdown',
      restart: 'system_restart',
      lock: 'system_lock',
      sleep: 'system_sleep',
    };
    return {
      action: actionMap[command],
      risk_level: 'high',
      requires_confirmation: true,
    };
  }

  private parseSystemCommand(text: string): string | null {
    const commands = {
      ar: {
        shutdown: [/^\s*أطفئ\s+(?:الجهاز|الكمبيوتر)\s*$/i, /^\s*إيقاف\s+التشغيل\s*$/i],
        restart: [/^\s*(?:أعد|إعادة)\s+التشغيل\s*$/i, /^\s*restart\s*$/i],
        lock: [/^\s*(?:قفل|اقفل)\s+الشاشة\s*$/i, /^\s*lock\s*$/i],
        sleep: [/^\s*وضع\s+السبات\s*$/i, /^\s*(?:sleep|hibernate)\s*$/i],
      },
      tr: {
        shutdown: [/^\s*bilgisayarı\s+kapat\s*$/i, /^\s*kapat\s+sistem\s*$/i],
        restart: [/^\s*yeniden\s+başlat\s*$/i, /^\s*(?:restart|reboot)\s*$/i],
        lock: [/^\s*ekranı\s+kilit\s*$/i, /^\s*kilit\s+ekran\s*$/i, /^\s*lock\s*$/i],
        sleep: [/^\s*uyku\s+modu\s*$/i, /^\s*(?:sleep|hibernate)\s*$/i],
      },
      en: {
        shutdown: [/^\s*(?:shutdown|shut\s+down|power\s+off)(?:\s+(?:the\s+)?(?:computer|pc|system))?\s*$/i],
        restart: [/^\s*(?:restart|reboot)(?:\s+(?:the\s+)?(?:computer|pc|system))?\s*$/i],
        lock: [/^\s*lock\s+(?:the\s+)?(?:screen|computer|pc)\s*$/i],
        sleep: [/^\s*(?:sleep|hibernate|standby)(?:\s+(?:the\s+)?(?:computer|pc|system))?\s*$/i],
      },
    };

    for (const langCommands of Object.values(commands)) {
      for (const [command, patterns] of Object.entries(langCommands)) {
        if (patterns.some(pattern => pattern.test(text))) return command;
      }
    }
    return null;
  }
}
