import { VoiceInput } from '../VoiceInput';
import { VoiceOutput } from '../VoiceOutput';
import { VoiceInputAdapter } from '../VoiceInputAdapter';
import { VoiceOutputAdapter } from '../VoiceOutputAdapter';

describe('Voice modules', () => {
  it('uses provider transcription before fallback', async () => {
    const provider: VoiceInputAdapter = {
      transcribe: jest.fn().mockResolvedValue('راجع هذا الملف'),
      detectLanguage: jest.fn().mockReturnValue('ar')
    };
    const input = new VoiceInput(provider, 'non-existent-whisper');
    const text = await input.listen('/tmp/audio.wav');
    expect(text).toBe('راجع هذا الملف');
  });

  it('falls back to output adapter when edge-tts is unavailable', async () => {
    const adapter: VoiceOutputAdapter = {
      speak: jest.fn().mockResolvedValue(undefined)
    };
    const output = new VoiceOutput(adapter, 'non-existent-edge-tts');
    await output.speak('اختبار الصوت', 'ar', 'short');
    expect(adapter.speak).toHaveBeenCalled();
  });
});

