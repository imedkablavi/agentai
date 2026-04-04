import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';
export declare class DeveloperSkill implements Skill {
    name: string;
    supported_intents: string[];
    validate(intent: Intent, _context: ConversationContext): boolean;
    execute(intent: Intent, context: ConversationContext): Promise<ExecutionCommand>;
}
//# sourceMappingURL=DeveloperSkill.d.ts.map