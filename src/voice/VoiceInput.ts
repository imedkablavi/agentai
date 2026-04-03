import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { DummyVoiceInputAdapter, VoiceInputAdapter } from './VoiceInputAdapter';

const execAsync = promisify(exec);

export class VoiceInput {
  constructor(
    private provider: VoiceInputAdapter = new DummyVoiceInputAdapter(),
    private whisperCmd: string = 'python -m whisper'
  ) {}

  async listen(audioFilePath?: string): Promise<string> {
    if (!audioFilePath) return '';
    const providerText = await this.provider.transcribe(audioFilePath);
    if (providerText.trim()) return providerText.trim();

    try {
      const escapedPath = audioFilePath.replace(/"/g, '\\"');
      const { stdout } = await execAsync(`${this.whisperCmd} "${escapedPath}" --language auto --task transcribe --output_format txt`);
      const base = path.parse(audioFilePath).name;
      const dir = path.parse(audioFilePath).dir;
      const txtPath = path.join(dir, `${base}.txt`);
      if (fs.existsSync(txtPath)) {
        const content = fs.readFileSync(txtPath, 'utf8');
        return String(content || '').trim();
      }
      return stdout?.trim() || '';
    } catch {
      return '';
    }
  }
}
