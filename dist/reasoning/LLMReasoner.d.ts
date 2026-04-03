import { Intent } from '../types';
export declare class LLMReasoner {
    private endpoint;
    private model;
    private systemPrompt;
    infer(text: string): Promise<Intent | null>;
    private extractJson;
}
//# sourceMappingURL=LLMReasoner.d.ts.map