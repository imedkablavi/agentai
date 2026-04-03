"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillRouter = void 0;
const ApplicationSkill_1 = require("./ApplicationSkill");
const WebSearchSkill_1 = require("./WebSearchSkill");
const YouTubeSkill_1 = require("./YouTubeSkill");
const SystemSkill_1 = require("./SystemSkill");
const SelectionSkill_1 = require("./SelectionSkill");
const MemorySkill_1 = require("./MemorySkill");
const DeveloperSkill_1 = require("./DeveloperSkill");
class SkillRouter {
    constructor() {
        this.skills = [];
        this.safetyThreshold = 0.85;
        this.permissionRequiredIntents = [
            'system_command', 'shutdown', 'restart', 'format', 'delete'
        ];
        this.initializeSkills();
    }
    route(intent, context) {
        // Check confidence threshold
        if (intent.confidence < 0.3) {
            return null;
        }
        // Check safety requirements
        if (!this.validateSafety(intent)) {
            return null;
        }
        // Find matching skill
        for (const skill of this.skills) {
            if (skill.supported_intents.includes(intent.name)) {
                if (skill.validate(intent, context)) {
                    return skill;
                }
            }
        }
        // Try fallback skills for unknown intents
        if (intent.name === 'unknown') {
            return this.getFallbackSkill(intent, context);
        }
        return null;
    }
    validatePermissions(skill, intent) {
        // Check if intent requires elevated permissions
        if (this.permissionRequiredIntents.some(permIntent => intent.name.includes(permIntent))) {
            return intent.confidence >= this.safetyThreshold;
        }
        // Check for destructive commands
        if (this.isDestructiveIntent(intent)) {
            return intent.confidence >= this.safetyThreshold;
        }
        return true;
    }
    getAvailableSkills() {
        return this.skills;
    }
    initializeSkills() {
        this.skills = [
            new ApplicationSkill_1.ApplicationSkill(),
            new WebSearchSkill_1.WebSearchSkill(),
            new YouTubeSkill_1.YouTubeSkill(),
            new SystemSkill_1.SystemSkill(),
            new SelectionSkill_1.SelectionSkill(),
            new MemorySkill_1.MemorySkill(),
            new DeveloperSkill_1.DeveloperSkill()
        ];
    }
    validateSafety(intent) {
        // High confidence required for system commands
        if (intent.name.includes('system_command')) {
            return intent.confidence >= 0.9;
        }
        // Check for ambiguous commands
        if (intent.confidence < 0.6 && this.isAmbiguousIntent(intent)) {
            return false;
        }
        return true;
    }
    getFallbackSkill(intent, context) {
        // Try to infer skill from context
        if (context.active_skill) {
            const activeSkill = this.skills.find(s => s.name === context.active_skill);
            if (activeSkill && activeSkill.validate(intent, context)) {
                return activeSkill;
            }
        }
        // Try web search for unknown queries
        if (intent.raw_text.length > 3) {
            const webSearchSkill = this.skills.find(s => s.name === 'WebSearchSkill');
            if (webSearchSkill) {
                intent.name = 'search_web';
                intent.entities.query = intent.raw_text;
                return webSearchSkill;
            }
        }
        return null;
    }
    isDestructiveIntent(intent) {
        const destructivePatterns = [
            /delete/i, /remove/i, /format/i, /erase/i, /destroy/i,
            /احذف/i, /امسح/i, /افرغ/i, /نسف/i,
            /sil/i, /temizle/i, /yok et/i
        ];
        return destructivePatterns.some(pattern => pattern.test(intent.raw_text));
    }
    isAmbiguousIntent(intent) {
        const ambiguousPatterns = [
            /this/i, /that/i, /it/i, /them/i,
            /هذا/i, /ذلك/i, /هذه/i, /ذلكم/i,
            /bu/i, /şu/i, /o/i
        ];
        return ambiguousPatterns.some(pattern => pattern.test(intent.raw_text)) &&
            !intent.entities.query &&
            !intent.entities.application;
    }
    addSkill(skill) {
        this.skills.push(skill);
    }
    removeSkill(skillName) {
        this.skills = this.skills.filter(s => s.name !== skillName);
    }
    updateSafetyThreshold(threshold) {
        this.safetyThreshold = Math.max(0.5, Math.min(1.0, threshold));
    }
}
exports.SkillRouter = SkillRouter;
//# sourceMappingURL=SkillRouter.js.map