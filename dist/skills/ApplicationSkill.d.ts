import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';
export declare class ApplicationSkill implements Skill {
    name: string;
    supported_intents: string[];
    private applicationMap;
    validate(intent: Intent, context: ConversationContext): boolean;
    execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand>;
}
//# sourceMappingURL=ApplicationSkill.d.ts.map