import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Intent } from '../types';
import { buildChildProcessEnv } from '../security/ChildProcessEnv';

const execFileAsync = promisify(execFile);

const ALLOWED_INTENTS = new Set([
  'unknown',
  'schedule_task',
  'stop_tasks',
  'open_application',
  'close_application',
  'search_web',
  'youtube_search',
  'system_command',
  'select_item',
  'continue_action',
  'confirm_action',
  'memory_command',
  'dev_inspect',
  'dev_test',
  'dev_fix',
  'open_file',
  'read_file',
  'summarize_logs',
]);

export function normalizeReasonerPayload(parsed: any, text: string): Intent | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const rawName = typeof parsed.intent_name === 'string' ? parsed.intent_name.trim() : 'unknown';
  const name = ALLOWED_INTENTS.has(rawName) ? rawName : 'unknown';
  const language = parsed.language === 'tr' || parsed.language === 'en' || parsed.language === 'ar' ? parsed.language : 'ar';
  const rawConfidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence) ? parsed.confidence : 0;
  const confidence = Math.max(0, Math.min(1, rawConfidence));
  const sourceEntities = parsed.entities && typeof parsed.entities === 'object' ? parsed.entities : {};
  const entities: Intent['entities'] = {};

  if (typeof sourceEntities.application === 'string' && sourceEntities.application.length <= 100) {
    entities.application = sourceEntities.application.trim().toLowerCase();
  }
  if (typeof sourceEntities.query === 'string' && sourceEntities.query.length <= 2000) {
    entities.query = sourceEntities.query.trim();
  }
  if (Number.isInteger(sourceEntities.index) && sourceEntities.index > 0 && sourceEntities.index <= 1000) {
    entities.index = sourceEntities.index;
  }
  if (typeof sourceEntities.time === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(sourceEntities.time)) {
    entities.time = sourceEntities.time;
  }
  if (typeof sourceEntities.repeat === 'string' && sourceEntities.repeat.length <= 100) {
    entities.repeat = sourceEntities.repeat.trim();
  }

  return {
    name,
    confidence,
    language,
    context_required: false,
    entities,
    raw_text: text,
  };
}

export class LLMReasoner {
  private readonly endpoint = 'http://127.0.0.1:11434/api/generate';
  private readonly model = 'qwen2.5:7b-instruct';
  private readonly systemPrompt = (
    'أنت طبقة فهم نوايا لمساعد مكتبي محلي.\n' +
    'مهمتك فهم العربية الطبيعية أو التركية أو الإنجليزية،\n' +
    'واستخراج نية واحدة فقط بصيغة JSON، بدون تنفيذ وبدون أوامر shell.\n' +
    'لا تعتبر confidence إذناً للتنفيذ؛ هو فقط مؤشر لفهم النص.\n\n' +
    '{\n' +
    '  "intent_name": "string",\n' +
    '  "confidence": 0.0,\n' +
    '  "language": "ar | tr | en",\n' +
    '  "entities": {\n' +
    '    "application": null,\n' +
    '    "query": null,\n' +
    '    "time": null,\n' +
    '    "repeat": null,\n' +
    '    "index": null\n' +
    '  },\n' +
    '  "follow_up": null\n' +
    '}\n'
  );

  async infer(text: string): Promise<Intent | null> {
    const input = text.trim();
    if (!input || input.length > 8000) return null;
    const prompt = `${this.systemPrompt}\n\nالنص:\n${input}`;

    try {
      const response = await axios.post(
        this.endpoint,
        { model: this.model, prompt, stream: false },
        {
          timeout: 15_000,
          proxy: false,
          maxContentLength: 2_000_000,
          maxBodyLength: 2_000_000,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      return this.parseResponse(String(response.data?.response || ''), input);
    } catch {
      return this.inferViaLocalCli(prompt, input);
    }
  }

  private async inferViaLocalCli(prompt: string, input: string): Promise<Intent | null> {
    try {
      const executable = process.platform === 'win32' && process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe')
        : 'ollama';
      const { stdout } = await execFileAsync(executable, ['run', this.model, prompt], {
        timeout: 20_000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
        env: buildChildProcessEnv(),
      });
      return this.parseResponse(String(stdout || ''), input);
    } catch {
      return null;
    }
  }

  private parseResponse(raw: string, input: string): Intent | null {
    const json = this.extractJson(raw.trim());
    if (!json) return null;
    try {
      return normalizeReasonerPayload(JSON.parse(json), input);
    } catch {
      return null;
    }
  }

  private extractJson(value: string): string | null {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = value.slice(start, end + 1);
    return candidate.length <= 32_000 ? candidate : null;
  }
}
