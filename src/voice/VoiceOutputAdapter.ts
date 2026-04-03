export interface VoiceOutputAdapter {
  speak(text: string, language: string): Promise<void>;
}

export class ConsoleVoiceOutputAdapter implements VoiceOutputAdapter {
  async speak(text: string, _language: string): Promise<void> {
    console.log(`🔊 ${text}`);
  }
}

