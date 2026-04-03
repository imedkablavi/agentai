import { VoiceLanguage } from './VoiceInputAdapter';

export interface VoiceOutputAdapter {
  speak(text: string, language: VoiceLanguage): Promise<void>;
}

export class ConsoleVoiceOutputAdapter implements VoiceOutputAdapter {
  async speak(text: string, _language: VoiceLanguage): Promise<void> {
    console.log(`🔊 ${text}`);
  }
}
