export interface VoiceOutputAdapter {
    speak(text: string, language: string): Promise<void>;
}
export declare class ConsoleVoiceOutputAdapter implements VoiceOutputAdapter {
    speak(text: string, _language: string): Promise<void>;
}
//# sourceMappingURL=VoiceOutputAdapter.d.ts.map