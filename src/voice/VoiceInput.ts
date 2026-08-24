import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DummyVoiceInputAdapter, VoiceInputAdapter } from './VoiceInputAdapter';
import { buildChildProcessEnv } from '../security/ChildProcessEnv';
import { ensurePrivateDir, getAgentDataDir } from '../security/SecureStorage';

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm']);

export class VoiceInput {
  private readonly workspaceRoot: string;
  private readonly voiceTempRoot: string;

  constructor(
    private provider: VoiceInputAdapter = new DummyVoiceInputAdapter(),
    private whisperExecutable: string = 'python',
    private whisperArgs: string[] = ['-m', 'whisper'],
    workspaceRoot: string = process.cwd(),
    dataDir: string = getAgentDataDir(),
  ) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.voiceTempRoot = path.join(dataDir, 'voice', 'tmp');
  }

  async listen(audioFilePath?: string): Promise<string> {
    const audioPath = this.validateAudioPath(audioFilePath);
    if (!audioPath) return '';

    const providerText = await this.provider.transcribe(audioPath);
    if (providerText.trim()) return providerText.trim().slice(0, 8000);

    const outputDir = path.join(this.voiceTempRoot, randomUUID());
    try {
      ensurePrivateDir(outputDir);
      const { stdout } = await execFileAsync(this.whisperExecutable, [
        ...this.whisperArgs,
        audioPath,
        '--language',
        'auto',
        '--task',
        'transcribe',
        '--output_format',
        'txt',
        '--output_dir',
        outputDir,
      ], {
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        env: buildChildProcessEnv(),
      });

      const txtPath = path.join(outputDir, `${path.parse(audioPath).name}.txt`);
      if (fs.existsSync(txtPath)) {
        const content = fs.readFileSync(txtPath, 'utf8');
        return String(content || '').trim().slice(0, 8000);
      }
      return String(stdout || '').trim().slice(0, 8000);
    } catch {
      return '';
    } finally {
      try {
        fs.rmSync(outputDir, { recursive: true, force: true });
      } catch {
        // Failure to clean temporary transcription state does not expose it in the workspace.
      }
    }
  }

  private validateAudioPath(rawPath?: string): string | null {
    if (!rawPath || rawPath.length > 1000 || /[\u0000\r\n]/.test(rawPath)) return null;

    try {
      const absolute = path.resolve(this.workspaceRoot, rawPath);
      const relative = path.relative(this.workspaceRoot, absolute);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
      if (!fs.existsSync(absolute)) return null;

      const real = fs.realpathSync(absolute);
      const realRelative = path.relative(this.workspaceRoot, real);
      if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) return null;

      const stat = fs.statSync(real);
      if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_AUDIO_BYTES) return null;
      if (!AUDIO_EXTENSIONS.has(path.extname(real).toLowerCase())) return null;
      return real;
    } catch {
      return null;
    }
  }
}
