import { VoiceInputAdapter } from './VoiceInputAdapter';
export declare class VoiceInput {
    private provider;
    private whisperExecutable;
    private whisperArgs;
    constructor(provider?: VoiceInputAdapter, whisperExecutable?: string, whisperArgs?: string[]);
    listen(audioFilePath?: string): Promise<string>;
}
//# sourceMappingURL=VoiceInput.d.ts.map