import { VoiceInputAdapter } from './VoiceInputAdapter';
export declare class VoiceInput {
    private provider;
    private whisperCmd;
    constructor(provider?: VoiceInputAdapter, whisperCmd?: string);
    listen(audioFilePath?: string): Promise<string>;
}
//# sourceMappingURL=VoiceInput.d.ts.map