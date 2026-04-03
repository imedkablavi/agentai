import { SkillRouter as ISkillRouter, Skill, Intent, ConversationContext } from '../types';
export declare class SkillRouter implements ISkillRouter {
    private skills;
    private safetyThreshold;
    private permissionRequiredIntents;
    constructor();
    route(intent: Intent, context: ConversationContext): Skill | null;
    validatePermissions(skill: Skill, intent: Intent): boolean;
    getAvailableSkills(): Skill[];
    private initializeSkills;
    private validateSafety;
    private getFallbackSkill;
    private isDestructiveIntent;
    private isAmbiguousIntent;
    addSkill(skill: Skill): void;
    removeSkill(skillName: string): void;
    updateSafetyThreshold(threshold: number): void;
}
//# sourceMappingURL=SkillRouter.d.ts.map