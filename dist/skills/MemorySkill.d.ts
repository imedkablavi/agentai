import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';
export declare class MemorySkill implements Skill {
    name: string;
    supported_intents: string[];
    validate(intent: Intent, _context: ConversationContext): boolean;
    execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand>;
}
//# sourceMappingURL=MemorySkill.d.ts.map