export interface VoiceInputAdapter {
    listen(): Promise<string>;
    detect_language(text: string): 'ar' | 'tr' | 'en';
}
export declare class DummyVoiceInputAdapter implements VoiceInputAdapter {
    listen(): Promise<string>;
    detect_language(text: string): 'ar' | 'tr' | 'en';
}
//# sourceMappingURL=VoiceInputAdapter.d.ts.map