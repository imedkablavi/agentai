import { execFile } from 'child_process';
import { promisify } from 'util';
import { VoiceLanguage } from './VoiceInputAdapter';
import { ConsoleVoiceOutputAdapter, VoiceOutputAdapter } from './VoiceOutputAdapter';
import { buildChildProcessEnv } from '../security/ChildProcessEnv';

const execFileAsync = promisify(execFile);

const voiceMap: Record<string, string> = {
  ar: 'Microsoft Farid Online (Natural) - Arabic (Egypt)',
  tr: 'Microsoft Seda Online (Natural) - Turkish (Turkey)',
  en: 'Microsoft Aria Online (Natural) - English (US)',
};

export class VoiceOutput {
  constructor(
    private adapter: VoiceOutputAdapter = new ConsoleVoiceOutputAdapter(),
    private edgeTtsCmd: string = 'edge-tts',
    private networkTtsEnabled: boolean = process.env.AGENTAI_ENABLE_EDGE_TTS === 'true',
  ) {}

  async speak(text: string, language: VoiceLanguage, mode: 'short' | 'long' = 'short'): Promise<void> {
    const cleaned = String(text || '').trim().slice(0, 4000);
    if (!cleaned) return;
    const voice = voiceMap[language] || voiceMap.en;
    const spoken = (mode === 'long' ? cleaned : cleaned.split(/[.!؟！]/)[0].trim()).slice(0, 2000);
    if (!spoken) return;

    if (this.networkTtsEnabled) {
      try {
        await execFileAsync(this.edgeTtsCmd, ['--voice', voice, '--text', spoken], {
          timeout: 30_000,
          maxBuffer: 512 * 1024,
          windowsHide: true,
          env: buildChildProcessEnv(),
        });
        return;
      } catch {
        // Fall back to the configured local adapter without exposing command output.
      }
    }

    await this.adapter.speak(spoken, language);
  }
}
