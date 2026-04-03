import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';
export declare class PersonalAssistantSkill implements Skill {
    name: string;
    supported_intents: string[];
    validate(intent: Intent): boolean;
    execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand>;
}
//# sourceMappingURL=PersonalAssistantSkill.d.ts.map