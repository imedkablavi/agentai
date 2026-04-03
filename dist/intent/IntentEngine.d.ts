import { IntentEngine as IIntentEngine, Intent, ConversationContext } from '../types';
export declare class IntentEngine implements IIntentEngine {
    private intentPatterns;
    private entityPatterns;
    classify(text: string, context: ConversationContext): Promise<Intent>;
    extractEntities(text: string, intent: Intent): Promise<Intent>;
    calculateConfidence(intent: Intent, context: ConversationContext): number;
    private detectLanguage;
    private calculatePatternConfidence;
    private isContextRequired;
    private inferFollowUpIntent;
    private extractApplication;
    private getLastLanguageFromHistory;
}
//# sourceMappingURL=IntentEngine.d.ts.map