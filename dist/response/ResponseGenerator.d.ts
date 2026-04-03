import { ResponseGenerator as IResponseGenerator, SkillResult, ConversationContext } from '../types';
export declare class ResponseGenerator implements IResponseGenerator {
    private responseTemplates;
    generateResponse(result: SkillResult, context: ConversationContext): string;
    generateFollowUp(result: SkillResult, context: ConversationContext): string;
    generateErrorResponse(error: {
        type: 'network' | 'permission' | 'context' | 'unknown';
        recoverable: boolean;
        user_message: string;
        retry_suggested: boolean;
    }, language: 'ar' | 'tr' | 'en'): string;
    formatForVoice(text: string): string;
    formatForText(text: string): string;
    private generateSuccessResponse;
    private generateErrorFromResult;
    private determineActionType;
    private determineErrorType;
    private detectLanguage;
    private detectLanguageFromText;
    private formatTemplate;
    generateProactiveSuggestion(context: ConversationContext): string;
    generateContextualHelp(context: ConversationContext): string;
}
//# sourceMappingURL=ResponseGenerator.d.ts.map