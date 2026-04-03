"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSkill = void 0;
class SystemSkill {
    constructor() {
        this.name = 'SystemSkill';
        this.supported_intents = ['system_command'];
    }
    validate(intent, context) {
        // High confidence required for system commands
        return intent.confidence >= 0.9;
    }
    async execute(intent, _context) {
        const command = this.parseSystemCommand(intent.raw_text);
        if (!command)
            return { action: 'unknown', risk_level: 'high', requires_confirmation: true };
        const actionMap = {
            shutdown: 'system_shutdown', restart: 'system_restart', lock: 'system_lock', sleep: 'system_sleep'
        };
        return {
            action: actionMap[command],
            risk_level: 'high',
            requires_confirmation: true
        };
    }
    parseSystemCommand(text) {
        const commands = {
            ar: {
                'shutdown': [/أطفئ\s+الجهاز/i, /أطفئ\s+الكمبيوتر/i, /إيقاف\s+التشغيل/i],
                'restart': [/أعد\s+التشغيل/i, /إعادة\s+التشغيل/i, /restart/i],
                'lock': [/قفل\s+الشاشة/i, /اقفل\s+الشاشة/i, /lock/i],
                'sleep': [/وضع\s+السبات/i, /sleep/i, /hibernate/i]
            },
            tr: {
                'shutdown': [/bilgisayarı\s+kapat/i, /kapat\s+computers/i, /kapat\s+sistem/i],
                'restart': [/yeniden\s+başlat/i, /restart/i, /reboot/i],
                'lock': [/ekranı\s+kilit/i, /kilit\s+ekran/i, /lock/i],
                'sleep': [/uyku\s+modu/i, /sleep/i, /hibernate/i]
            },
            en: {
                'shutdown': [/shutdown/i, /shut\s+down/i, /power\s+off/i],
                'restart': [/restart/i, /reboot/i, /reset/i],
                'lock': [/lock\s+screen/i, /lock\s+computer/i, /lock/i],
                'sleep': [/sleep/i, /hibernate/i, /standby/i]
            }
        };
        for (const [lang, langCommands] of Object.entries(commands)) {
            for (const [command, patterns] of Object.entries(langCommands)) {
                if (patterns.some(pattern => pattern.test(text))) {
                    return command;
                }
            }
        }
        return null;
    }
    getSuggestedActions(command) {
        const actions = {
            'shutdown': ['Cancel shutdown', 'Restart instead', 'Lock screen'],
            'restart': ['Cancel restart', 'Shutdown instead', 'Lock screen'],
            'lock': ['Unlock screen', 'Shutdown', 'Restart'],
            'sleep': ['Wake up', 'Shutdown', 'Restart']
        };
        return actions[command] || ['Try another command'];
    }
}
exports.SystemSkill = SystemSkill;
//# sourceMappingURL=SystemSkill.js.map