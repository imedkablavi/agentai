"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSearchSkill = void 0;
class WebSearchSkill {
    constructor() {
        this.name = 'WebSearchSkill';
        this.supported_intents = ['search_web'];
    }
    validate(intent, context) {
        return !!intent.entities.query && intent.entities.query.length > 0;
    }
    async execute(intent, _context) {
        const query = intent.entities.query;
        return {
            action: 'web_search',
            params: { query },
            risk_level: 'low',
            requires_confirmation: false
        };
    }
}
exports.WebSearchSkill = WebSearchSkill;
//# sourceMappingURL=WebSearchSkill.js.map