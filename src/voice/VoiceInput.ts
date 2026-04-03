import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VoiceInput {
  constructor(private whisperCmd: string = 'python -m whisper') {}

  async listen(audioFilePath?: string): Promise<string> {
    if (!audioFilePath) return '';
    try {
      const { stdout } = await execAsync(`${this.whisperCmd} "${audioFilePath}" --language auto --task transcribe --output_format txt`);
      // stdout may contain logs; result likely saved to file; attempt to read from stdout or fallback
      const fs = await import('fs');
      const path = await import('path');
      const base = path.default.parse(audioFilePath).name;
      const dir = path.default.parse(audioFilePath).dir;
      const txtPath = path.default.join(dir, `${base}.txt`);
      if (fs.default.existsSync(txtPath)) {
        const content = fs.default.readFileSync(txtPath, 'utf8');
        return String(content || '').trim();
      }
      return stdout?.trim() || '';
    } catch {
      return '';
    }
  }
}
