import { AIAssistant } from '../AIAssistant';
import { VoiceInput } from './VoiceInput';
import { VoiceOutput } from './VoiceOutput';

export class VoiceController {
  constructor(private assistant: AIAssistant, private input: VoiceInput, private output: VoiceOutput) {}

  async processOnce(audioFilePath?: string): Promise<void> {
    const prefs = this.assistant.getPreferences();
    if (!prefs.voice_mode) return;
    const text = await this.input.listen(audioFilePath);
    if (!text) return;
    const result = await this.assistant.processInput(text);
    // One sentence only in voice mode
    await this.output.speak(result.voiceResponse, prefs.language);
  }
}

