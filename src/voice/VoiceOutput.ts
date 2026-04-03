import { execFile } from 'child_process';
import { promisify } from 'util';
import { VoiceLanguage } from './VoiceInputAdapter';
import { ConsoleVoiceOutputAdapter, VoiceOutputAdapter } from './VoiceOutputAdapter';

const execFileAsync = promisify(execFile);

const voiceMap: Record<string, string> = {
  ar: 'Microsoft Farid Online (Natural) - Arabic (Egypt)',
  tr: 'Microsoft Seda Online (Natural) - Turkish (Turkey)',
  en: 'Microsoft Aria Online (Natural) - English (US)'
};

export class VoiceOutput {
  constructor(
    private adapter: VoiceOutputAdapter = new ConsoleVoiceOutputAdapter(),
    private edgeTtsCmd: string = 'edge-tts'
  ) {}

  async speak(text: string, language: VoiceLanguage, mode: 'short' | 'long' = 'short'): Promise<void> {
    const cleaned = String(text || '').trim();
    if (!cleaned) return;
    const voice = voiceMap[language] || voiceMap.en;
    const spoken = mode === 'long' ? cleaned : cleaned.split(/[.!؟！]/)[0].trim();
    if (!spoken) return;

    try {
      await execFileAsync(this.edgeTtsCmd, ['--voice', voice, '--text', spoken]);
      return;
    } catch {
      await this.adapter.speak(spoken, language);
    }
  }
}
