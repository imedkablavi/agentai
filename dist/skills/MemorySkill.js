"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySkill = void 0;
class MemorySkill {
    constructor() {
        this.name = 'MemorySkill';
        this.supported_intents = ['memory_command'];
        // Stateless: no memory typing here; executor/MemMgr handles rules
    }
    validate(intent, _context) {
        return !!intent.entities.query && intent.entities.query.length > 0;
    }
    async execute(intent, _context) {
        const memoryContent = intent.entities.query;
        return {
            action: 'store_memory',
            params: { content: memoryContent },
            risk_level: 'low',
            requires_confirmation: false
        };
    }
}
exports.MemorySkill = MemorySkill;
//# sourceMappingURL=MemorySkill.js.map