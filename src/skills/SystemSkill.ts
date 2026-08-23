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
        shutdown: [/أطفئ\s+الجهاز/i, /أطفئ\s+الكمبيوتر/i, /إيقاف\s+التشغيل/i],
        restart: [/أعد\s+التشغيل/i, /إعادة\s+التشغيل/i, /restart/i],
        lock: [/قفل\s+الشاشة/i, /اقفل\s+الشاشة/i, /lock/i],
        sleep: [/وضع\s+السبات/i, /sleep/i, /hibernate/i],
      },
      tr: {
        shutdown: [/bilgisayarı\s+kapat/i, /kapat\s+sistem/i],
        restart: [/yeniden\s+başlat/i, /restart/i, /reboot/i],
        lock: [/ekranı\s+kilit/i, /kilit\s+ekran/i, /lock/i],
        sleep: [/uyku\s+modu/i, /sleep/i, /hibernate/i],
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
