export interface Intent {
    name: string;
    confidence: number;
    language: 'ar' | 'tr' | 'en';
    context_required: boolean;
    entities: {
        application?: string;
        query?: string;
        index?: number;
        url?: string;
        [key: string]: any;
    };
    raw_text: string;
}
export interface SkillResult {
    success: boolean;
    data?: any;
    error?: string;
    error_detail?: ErrorResponse;
    requires_followup?: boolean;
    suggested_actions?: string[];
}
export interface Skill {
    name: string;
    supported_intents: string[];
    validate(intent: Intent, context: ConversationContext): boolean;
    execute(intent: Intent, context: ConversationContext): Promise<ExecutionCommand>;
}
export interface ShortTermMemory {
    last_intent: string;
    last_query: string;
    timestamp: string;
    last_application?: string;
    last_topic?: string;
}
export interface LongTermMemory {
    type: 'habit' | 'pattern' | 'preference';
    description: string;
    frequency: number;
    last_occurrence: string;
    metadata?: any;
    id?: string;
}
export interface PreferenceMemory {
    language: 'ar' | 'tr' | 'en';
    browser: string;
    voice_mode: boolean;
    voice_response_mode?: 'short' | 'long';
    auto_execute_threshold: number;
    confirmation_required: boolean;
}
export interface ConversationContext {
    state: ConversationState;
    active_skill?: string;
    active_topic?: string;
    awaiting_followup: boolean;
    awaiting_confirmation?: boolean;
    last_action?: string;
    conversation_history: string[];
    timestamp: string;
    selection_context?: SelectionContext | null;
    dev_patch_target?: string;
    dev_patch_content?: string;
}
export interface MemoryManager {
    getShortTermMemory(): ShortTermMemory | null;
    updateShortTermMemory(data: Partial<ShortTermMemory>): void;
    getLongTermMemories(): LongTermMemory[];
    addLongTermMemory(memory: LongTermMemory): void;
    updateLongTermMemory(type: string, description: string): void;
    pruneLongTermMemories(cutoffDays: number): void;
    getPreferences(): PreferenceMemory;
    updatePreferences(prefs: Partial<PreferenceMemory>): void;
    shouldStoreMemory(intent: Intent, context: ConversationContext): boolean;
}
export interface ContextManager {
    getContext(): ConversationContext;
    updateContext(updates: Partial<ConversationContext>): void;
    clearContext(): void;
    isFollowUpRequired(intent: Intent): boolean;
    getMissingContext(intent: Intent): string[];
    setState(state: ConversationState): void;
    setSelectionContext(context: SelectionContext | null): void;
    confirmPending(): void;
}
export interface IntentEngine {
    classify(text: string, context: ConversationContext): Promise<Intent>;
    extractEntities(text: string, intent: Intent): Promise<Intent>;
    calculateConfidence(intent: Intent, context: ConversationContext): number;
}
export interface SkillRouter {
    route(intent: Intent, context: ConversationContext): Skill | null;
    validatePermissions(skill: Skill, intent: Intent): boolean;
    getAvailableSkills(): Skill[];
}
export interface ResponseGenerator {
    generateResponse(result: SkillResult, context: ConversationContext): string;
    generateFollowUp(result: SkillResult, context: ConversationContext): string;
    formatForVoice(text: string): string;
    formatForText(text: string): string;
    generateErrorResponse(error: ErrorResponse, language: 'ar' | 'tr' | 'en'): string;
}
export interface SafetyConfig {
    min_confidence_threshold: number;
    destructive_commands: string[];
    confirmation_required_patterns: string[];
    max_retry_attempts: number;
}
export type ConversationState = 'IDLE' | 'AWAITING_SELECTION' | 'AWAITING_CONFIRMATION' | 'EXECUTING' | 'ERROR';
export interface SelectionItem {
    id: string;
    label: string;
    data: any;
}
export interface SelectionContext {
    type: 'search_results' | 'videos' | 'files';
    items: SelectionItem[];
    expires_at: string;
}
export interface ExecutionCommand {
    action: string;
    target?: string;
    params?: Record<string, any>;
    risk_level: 'low' | 'medium' | 'high';
    requires_confirmation: boolean;
}
export interface ErrorResponse {
    type: 'network' | 'permission' | 'context' | 'unknown';
    recoverable: boolean;
    user_message: string;
    retry_suggested: boolean;
}
export type TimeTrigger = {
    type: 'once';
    at: string;
} | {
    type: 'interval';
    every: 'day' | 'week';
    at: string;
} | {
    type: 'condition';
    check_every_minutes: number;
};
export interface ScheduledTask {
    id: string;
    trigger: TimeTrigger;
    intent: Intent;
    context_snapshot: ConversationContext;
    enabled: boolean;
    last_run?: string;
    next_run: string;
}
//# sourceMappingURL=index.d.ts.map