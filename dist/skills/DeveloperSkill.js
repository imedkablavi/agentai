"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeveloperSkill = void 0;
class DeveloperSkill {
    constructor() {
        this.name = 'DeveloperSkill';
        this.supported_intents = ['dev_inspect', 'dev_fix', 'dev_test', 'confirm_action'];
    }
    validate(intent, context) {
        return this.supported_intents.includes(intent.name);
    }
    async execute(intent, context) {
        const targetFile = intent.entities.query || intent.entities.application || intent.raw_text;
        // Safety check - operations modifying code might be medium/high risk
        if (intent.name === 'confirm_action' && context.last_action) {
            // Re-trigger the last action with confirmation bypassed via context
            intent.name = context.last_action;
        }
        if (intent.name === 'dev_inspect') {
            return {
                action: 'dev_inspect',
                target: targetFile,
                risk_level: 'low',
                requires_confirmation: false
            };
        }
        if (intent.name === 'dev_test') {
            return {
                action: 'dev_test',
                target: targetFile,
                risk_level: 'low',
                requires_confirmation: false
            };
        }
        if (intent.name === 'dev_fix') {
            return {
                action: 'dev_fix',
                target: targetFile,
                risk_level: 'medium',
                requires_confirmation: false // We handle confirmation in CommandExecutor manually for previews
            };
        }
        return { action: 'unknown', risk_level: 'low', requires_confirmation: false };
    }
}
exports.DeveloperSkill = DeveloperSkill;
//# sourceMappingURL=DeveloperSkill.js.map