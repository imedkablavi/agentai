"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeSkill = void 0;
class YouTubeSkill {
    constructor() {
        this.name = 'YouTubeSkill';
        this.supported_intents = ['youtube_search'];
    }
    validate(intent, _context) {
        return !!intent.entities.query && intent.entities.query.length > 0;
    }
    async execute(intent, _context) {
        const query = intent.entities.query;
        return {
            action: 'youtube_search',
            params: { query },
            risk_level: 'low',
            requires_confirmation: false
        };
    }
}
exports.YouTubeSkill = YouTubeSkill;
//# sourceMappingURL=YouTubeSkill.js.map