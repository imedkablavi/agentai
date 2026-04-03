export interface VoiceInputAdapter {
  listen(): Promise<string>;
  detect_language(text: string): 'ar' | 'tr' | 'en';
}

export class DummyVoiceInputAdapter implements VoiceInputAdapter {
  async listen(): Promise<string> {
    return '';
  }
  detect_language(text: string): 'ar' | 'tr' | 'en' {
    const arabic = /[\u0600-\u06FF]/.test(text);
    const turkish = /[\u00E7\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/.test(text);
    if (arabic) return 'ar';
    if (turkish) return 'tr';
    return 'en';
  }
}

