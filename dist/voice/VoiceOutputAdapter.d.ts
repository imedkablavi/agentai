import { VoiceLanguage } from './VoiceInputAdapter';
export interface VoiceOutputAdapter {
    speak(text: string, language: VoiceLanguage): Promise<void>;
}
export declare class ConsoleVoiceOutputAdapter implements VoiceOutputAdapter {
    speak(text: string, _language: VoiceLanguage): Promise<void>;
}
//# sourceMappingURL=VoiceOutputAdapter.d.ts.map