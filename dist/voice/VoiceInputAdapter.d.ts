export type VoiceLanguage = 'ar' | 'tr' | 'en';
export interface VoiceInputAdapter {
    transcribe(audioFilePath: string): Promise<string>;
    detectLanguage(text: string): VoiceLanguage;
}
export declare class DummyVoiceInputAdapter implements VoiceInputAdapter {
    transcribe(): Promise<string>;
    detectLanguage(text: string): VoiceLanguage;
}
//# sourceMappingURL=VoiceInputAdapter.d.ts.map