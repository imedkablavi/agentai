import { Skill, Intent, ConversationContext, ExecutionCommand } from '../types';
export declare class SystemSkill implements Skill {
    name: string;
    supported_intents: string[];
    validate(intent: Intent, context: ConversationContext): boolean;
    execute(intent: Intent, _context: ConversationContext): Promise<ExecutionCommand>;
    private parseSystemCommand;
    private getSuggestedActions;
}
//# sourceMappingURL=SystemSkill.d.ts.map