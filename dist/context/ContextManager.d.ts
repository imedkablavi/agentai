import { ContextManager as IContextManager, ConversationContext, Intent, ConversationState, SelectionContext } from '../types';
export declare class ContextManager implements IContextManager {
    private context;
    private readonly maxHistoryLength;
    private readonly contextTimeout;
    private lastUpdate;
    constructor();
    getContext(): ConversationContext;
    updateContext(updates: Partial<ConversationContext>): void;
    clearContext(): void;
    isFollowUpRequired(intent: Intent): boolean;
    getMissingContext(intent: Intent): string[];
    addToHistory(userInput: string, assistantResponse: string): void;
    getLastInteraction(): {
        user: string;
        assistant: string;
    } | null;
    isContextFresh(): boolean;
    private checkContextTimeout;
    private trimConversationHistory;
    getContextualIntent(intent: Intent): Intent;
    updateActiveSkill(skillName: string, topic?: string): void;
    clearActiveSkill(): void;
    setLastAction(action: string): void;
    getContextSummary(): string;
    shouldResetContext(intent: Intent): boolean;
    setState(state: ConversationState): void;
    setSelectionContext(context: SelectionContext | null): void;
    confirmPending(): void;
}
//# sourceMappingURL=ContextManager.d.ts.map