import { VoiceLanguage } from './VoiceInputAdapter';
import { VoiceOutputAdapter } from './VoiceOutputAdapter';
export declare class VoiceOutput {
    private adapter;
    private edgeTtsCmd;
    constructor(adapter?: VoiceOutputAdapter, edgeTtsCmd?: string);
    speak(text: string, language: VoiceLanguage, mode?: 'short' | 'long'): Promise<void>;
}
//# sourceMappingURL=VoiceOutput.d.ts.map