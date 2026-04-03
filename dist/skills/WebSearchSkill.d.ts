import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';
export declare class WebSearchSkill implements Skill {
    name: string;
    supported_intents: string[];
    validate(intent: Intent, context: ConversationContext): boolean;
    execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand>;
}
//# sourceMappingURL=WebSearchSkill.d.ts.map