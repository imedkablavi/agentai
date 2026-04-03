"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalAssistantSkill = void 0;
class PersonalAssistantSkill {
    constructor() {
        this.name = 'PersonalAssistantSkill';
        this.supported_intents = ['open_file', 'read_file', 'summarize_logs'];
    }
    validate(intent) {
        if (intent.name === 'summarize_logs')
            return true;
        return Boolean(intent.entities.file_path || intent.entities.query);
    }
    async execute(intent, _context) {
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
exports.PersonalAssistantSkill = PersonalAssistantSkill;
//# sourceMappingURL=PersonalAssistantSkill.js.map