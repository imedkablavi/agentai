import { MemoryManager as IMemoryManager, ShortTermMemory, LongTermMemory, PreferenceMemory, Intent, ConversationContext } from '../types';
export declare class MemoryManager implements IMemoryManager {
    private shortTermMemory;
    private longTermMemories;
    private preferences;
    private memoryThresholds;
    constructor();
    getShortTermMemory(): ShortTermMemory | null;
    updateShortTermMemory(data: Partial<ShortTermMemory>): void;
    getLongTermMemories(): LongTermMemory[];
    addLongTermMemory(memory: LongTermMemory): void;
    updateLongTermMemory(type: string, description: string): void;
    pruneLongTermMemories(cutoffDays?: number): void;
    getPreferences(): PreferenceMemory;
    updatePreferences(prefs: Partial<PreferenceMemory>): void;
    shouldStoreMemory(intent: Intent, context: ConversationContext): boolean;
    private loadMemories;
    private saveShortTermMemory;
    private saveLongTermMemories;
    private savePreferences;
    getMemoryInsights(): {
        habits: LongTermMemory[];
        recent_patterns: LongTermMemory[];
        preferences: PreferenceMemory;
    };
}
//# sourceMappingURL=MemoryManager.d.ts.map