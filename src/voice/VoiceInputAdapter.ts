export type VoiceLanguage = 'ar' | 'tr' | 'en';

export interface VoiceInputAdapter {
  transcribe(audioFilePath: string): Promise<string>;
  detectLanguage(text: string): VoiceLanguage;
}

export class DummyVoiceInputAdapter implements VoiceInputAdapter {
  async transcribe(): Promise<string> {
    return '';
  }

  detectLanguage(text: string): VoiceLanguage {
    const arabic = /[\u0600-\u06FF]/.test(text);
    const turkish = /[\u00E7\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/.test(text);
    if (arabic) return 'ar';
    if (turkish) return 'tr';
    return 'en';
  }
}

