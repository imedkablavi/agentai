"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectionSkill = void 0;
class SelectionSkill {
    constructor() {
        this.name = 'SelectionSkill';
        this.supported_intents = ['select_item'];
        // Stateless skill: no direct selection handling or memory
    }
    validate(intent, context) {
        // Must have an index and context from previous action
        return !!intent.entities.index &&
            !!(context.active_skill || context.awaiting_followup);
    }
    async execute(intent, _context) {
        const selectedIndex = intent.entities.index;
        return {
            action: 'select_item',
            params: { index: selectedIndex },
            risk_level: 'low',
            requires_confirmation: false
        };
    }
}
exports.SelectionSkill = SelectionSkill;
//# sourceMappingURL=SelectionSkill.js.map