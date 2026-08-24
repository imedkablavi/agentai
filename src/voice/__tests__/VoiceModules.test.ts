import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { VoiceInput } from '../VoiceInput';
import { VoiceOutput } from '../VoiceOutput';
import { VoiceInputAdapter } from '../VoiceInputAdapter';
import { VoiceOutputAdapter } from '../VoiceOutputAdapter';

describe('Voice modules', () => {
  let workspace: string;
  let dataDir: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'agentai-voice-workspace-'));
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentai-voice-data-'));
    fs.writeFileSync(path.join(workspace, 'audio.wav'), Buffer.from('RIFF-test-audio'));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('uses provider transcription for a validated workspace audio file', async () => {
    const provider: VoiceInputAdapter = {
      transcribe: jest.fn().mockResolvedValue('راجع هذا الملف'),
      detectLanguage: jest.fn().mockReturnValue('ar'),
    };
    const input = new VoiceInput(provider, 'non-existent-whisper', ['-m', 'whisper'], workspace, dataDir);
    const text = await input.listen('audio.wav');
    expect(text).toBe('راجع هذا الملف');
    expect(provider.transcribe).toHaveBeenCalledWith(fs.realpathSync(path.join(workspace, 'audio.wav')));
  });

  it('rejects audio paths outside the workspace before provider access', async () => {
    const outside = path.join(os.tmpdir(), `agentai-outside-${Date.now()}.wav`);
    fs.writeFileSync(outside, Buffer.from('RIFF-outside'));
    const provider: VoiceInputAdapter = {
      transcribe: jest.fn().mockResolvedValue('should not run'),
      detectLanguage: jest.fn().mockReturnValue('en'),
    };

    try {
      const input = new VoiceInput(provider, 'non-existent-whisper', ['-m', 'whisper'], workspace, dataDir);
      expect(await input.listen(outside)).toBe('');
      expect(provider.transcribe).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it('uses the local output adapter when network TTS is not explicitly enabled', async () => {
    const adapter: VoiceOutputAdapter = {
      speak: jest.fn().mockResolvedValue(undefined),
    };
    const output = new VoiceOutput(adapter, 'edge-tts', false);
    await output.speak('اختبار الصوت', 'ar', 'short');
    expect(adapter.speak).toHaveBeenCalledWith('اختبار الصوت', 'ar');
  });
});
