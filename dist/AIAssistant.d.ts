import { ConversationContext } from './types';
import { ScheduledTask } from './scheduler/types';
export declare class AIAssistant {
    private memoryManager;
    private contextManager;
    private intentEngine;
    private skillRouter;
    private responseGenerator;
    private executor;
    private scheduler;
    private taskRunner;
    private llm;
    private safetyConfig;
    constructor();
    processInput(userInput: string): Promise<{
        response: string;
        voiceResponse: string;
        context: ConversationContext;
        requiresFollowUp: boolean;
        suggestedActions: string[];
    }>;
    runScheduledIntent(task: ScheduledTask): Promise<void>;
    private isSafeIntent;
    getMemoryInsights(): {
        habits: import("./types").LongTermMemory[];
        recent_patterns: import("./types").LongTermMemory[];
        preferences: import("./types").PreferenceMemory;
    };
    getContextSummary(): string;
    clearContext(): void;
    updatePreferences(preferences: any): void;
    getPreferences(): import("./types").PreferenceMemory;
    addSkill(skill: any): void;
    removeSkill(skillName: string): void;
    updateSafetyThreshold(threshold: number): void;
}
//# sourceMappingURL=AIAssistant.d.ts.map